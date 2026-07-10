import { commandBus } from '../../bus/commandBus';
import { parseUtterance, isParseError } from './grammar';

declare global {
  interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((_ev: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((_ev: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}

export type VoiceState = 'listening' | 'idle' | 'error' | 'unsupported';

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
}

type Unsubscribe = () => void;

type RecognitionConstructor = {
  new(): SpeechRecognition;
};

const SR: RecognitionConstructor | null =
  typeof SpeechRecognition !== 'undefined'
    ? SpeechRecognition as unknown as RecognitionConstructor
    : typeof webkitSpeechRecognition !== 'undefined'
      ? webkitSpeechRecognition as unknown as RecognitionConstructor
      : null;

function createVoiceTrigger(): VoiceTrigger {
  let recognition: SpeechRecognition | null = null;
  let currentState: VoiceState = 'idle';

  const stateListeners = new Set<(state: VoiceState) => void>();
  const transcriptListeners = new Set<(partial: string, final: string) => void>();
  const errorListeners = new Set<(err: string) => void>();
  const rejectionListeners = new Set<(rejection: Rejection) => void>();

  function emitState(state: VoiceState): void {
    currentState = state;
    stateListeners.forEach((cb) => cb(state));
  }

  if (SR === null) {
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
    };
  }

  function startVoice(): void {
    if (SR === null) return;
    stopVoice();

    const rec = new SR();
    recognition = rec;

    rec.onstart = () => emitState('listening');
    rec.onerror = () => {
      errorListeners.forEach((cb) => cb('speech error'));
      emitState('error');
    };
    rec.onend = () => emitState('idle');
    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptListeners.forEach((cb) => cb('', transcript));
          const result = parseUtterance(transcript);
          if (isParseError(result)) {
            rejectionListeners.forEach((cb) => cb({ reason: result.reason, raw: result.raw }));
          } else {
            commandBus.submit(result);
          }
        } else {
          transcriptListeners.forEach((cb) => cb(transcript, ''));
        }
      }
    };

    try {
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.start();
    } catch (err) {
      errorListeners.forEach((cb) => cb(err instanceof Error ? err.message : String(err)));
      recognition = null;
      emitState('error');
    }
  }

  function stopVoice(): void {
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.abort();
      } catch {
        // ignore cleanup errors
      }
      recognition = null;
      emitState('idle');
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
  };
}

export const voiceTrigger = createVoiceTrigger();
