import { commandBus } from '../../bus/commandBus';
import { parseUtterance, isParseError, parseUtteranceSequence } from './grammar';
import { auditLog } from '../../audit';
import { transcribeWithWhisper } from '../../utils/whisperClient';
import { startSilenceDetection } from '../../utils/silenceDetector';
import { executeCommandSequence } from '../../bus/sequenceExecutor';

export type VoiceState = 'listening' | 'transcribing' | 'idle' | 'error' | 'unsupported';

export interface Rejection {
  reason: string;
  raw: string;
}

export interface VoiceTrigger {
  startVoice(): void;
  stopVoice(): void;
  onTranscript(cb: (partial: string, final: string) => void): Unsubscribe;
  onError(cb: (err: string) => void): Unsubscribe;
  onState(cb: (state: VoiceState) => void): Unsubscribe;
  onRejection(cb: (rejection: Rejection) => void): Unsubscribe;
  onVolume(cb: (volume: number) => void): Unsubscribe;
}

type Unsubscribe = () => void;

function getApiKey(): string {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('openai_api_key') || '';
  }
  return '';
}

function createVoiceTrigger(): VoiceTrigger {
  let mediaRecorder: MediaRecorder | null = null;
  let currentState: VoiceState = 'idle';
  let audioChunks: Blob[] = [];
  let processing = false;
  let silenceCleanup: (() => void) | null = null;

  const stateListeners = new Set<(state: VoiceState) => void>();
  const transcriptListeners = new Set<(partial: string, final: string) => void>();
  const errorListeners = new Set<(err: string) => void>();
  const rejectionListeners = new Set<(rejection: Rejection) => void>();
  const volumeListeners = new Set<(volume: number) => void>();

  function emitState(state: VoiceState): void {
    currentState = state;
    stateListeners.forEach((cb) => cb(state));
  }

  if (typeof window === 'undefined' || !navigator.mediaDevices || !window.MediaRecorder) {
    emitState('unsupported');
    return {
      startVoice() {},
      stopVoice() {},
      onTranscript(cb: (partial: string, final: string) => void): Unsubscribe {
        transcriptListeners.add(cb);
        return () => transcriptListeners.delete(cb);
      },
      onError(cb: (err: string) => void): Unsubscribe {
        errorListeners.add(cb);
        return () => errorListeners.delete(cb);
      },
      onState(cb: (state: VoiceState) => void): Unsubscribe {
        stateListeners.add(cb);
        cb(currentState);
        return () => stateListeners.delete(cb);
      },
      onRejection(cb: (rejection: Rejection) => void): Unsubscribe {
        rejectionListeners.add(cb);
        return () => rejectionListeners.delete(cb);
      },
      onVolume(cb: (volume: number) => void): Unsubscribe {
        volumeListeners.add(cb);
        return () => volumeListeners.delete(cb);
      },
    };
  }

  async function processAudio(blob: Blob): Promise<void> {
    if (processing) return;
    processing = true;

    try {
      const text = await transcribeWithWhisper(blob, getApiKey());
      const trimmed = text.trim();
      if (!trimmed) return;

      transcriptListeners.forEach((cb) => cb('', trimmed));

      const result = parseUtteranceSequence(trimmed);
      if (isParseError(result)) {
        rejectionListeners.forEach((cb) => cb({ reason: result.reason, raw: result.raw }));
        auditLog.append({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          command: {
            id: crypto.randomUUID(),
            source: 'voice',
            type: 'moveTo',
            timestamp: Date.now(),
          },
          verdict: 'REJECTED',
          reason: result.reason,
        });
      } else {
        await executeCommandSequence(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorListeners.forEach((cb) => cb(message));
      emitState('error');
    } finally {
      processing = false;
      audioChunks = [];
    }
  }

  async function startVoice(): Promise<void> {
    if (currentState === 'listening') return;
    if (processing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (silenceCleanup) {
          silenceCleanup();
          silenceCleanup = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        if (audioChunks.length > 0) {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          emitState('transcribing');
          await processAudio(blob);
        }
        if (currentState === 'transcribing') {
          emitState('idle');
        }
        mediaRecorder = null;
      };

      mediaRecorder.onerror = () => {
        if (silenceCleanup) {
          silenceCleanup();
          silenceCleanup = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        errorListeners.forEach((cb) => cb('MediaRecorder error'));
        emitState('error');
        mediaRecorder = null;
      };

      mediaRecorder.start();
      emitState('listening');

      // Start silence detection (1.1s silence auto-stop)
      silenceCleanup = startSilenceDetection(stream, {
        onSilence: () => {
          stopVoice();
        },
        onVolumeChange: (volume) => {
          volumeListeners.forEach((cb) => cb(volume));
        },
        threshold: 0.015,
        silenceDuration: 1100,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errorListeners.forEach((cb) => cb(message));
      emitState('error');
    }
  }

  function stopVoice(): void {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  return {
    startVoice,
    stopVoice,
    onTranscript(cb: (partial: string, final: string) => void): Unsubscribe {
      transcriptListeners.add(cb);
      return () => transcriptListeners.delete(cb);
    },
    onError(cb: (err: string) => void): Unsubscribe {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    onState(cb: (state: VoiceState) => void): Unsubscribe {
      stateListeners.add(cb);
      cb(currentState);
      return () => stateListeners.delete(cb);
    },
    onRejection(cb: (rejection: Rejection) => void): Unsubscribe {
      rejectionListeners.add(cb);
      return () => rejectionListeners.delete(cb);
    },
    onVolume(cb: (volume: number) => void): Unsubscribe {
      volumeListeners.add(cb);
      return () => volumeListeners.delete(cb);
    },
  };
}

export const voiceTrigger = createVoiceTrigger();
