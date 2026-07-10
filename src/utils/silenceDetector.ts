export interface SilenceDetectorOptions {
  onSilence: () => void;
  onVolumeChange?: (volume: number) => void;
  threshold?: number; // RMS threshold (0.0 to 1.0)
  silenceDuration?: number; // silence duration in ms before auto-stopping
}

export function startSilenceDetection(stream: MediaStream, options: SilenceDetectorOptions) {
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let animationFrameId: number | null = null;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext is not supported in this browser.');
      return () => {};
    }

    audioContext = new AudioContextClass();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Smaller fftSize is faster/easier for volume level checking
    source.connect(analyser);

    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    let lastSoundTime = Date.now();
    const threshold = options.threshold ?? 0.015; // default RMS threshold
    const silenceDuration = options.silenceDuration ?? 1100; // 1.1 seconds default after pull

    const check = () => {
      if (!analyser) return;

      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) volume
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128; // scale 0..255 to -1..1
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      if (options.onVolumeChange) {
        options.onVolumeChange(rms);
      }

      const now = Date.now();
      if (rms > threshold) {
        lastSoundTime = now;
      } else {
        if (now - lastSoundTime > silenceDuration) {
          options.onSilence();
          cleanup();
          return;
        }
      }

      animationFrameId = requestAnimationFrame(check);
    };

    check();
  } catch (err) {
    console.error('Failed to start silence detection:', err);
  }

  const cleanup = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
  };

  return cleanup;
}
