import { useCallback, useEffect, useRef, useState } from 'react';

import { uploadMediaBlob } from './upload_media_blob';

const DEFAULT_MAX_SECONDS = 60;
const WAVEFORM_BARS = 40;
const SAMPLE_INTERVAL_MS = 100;

// Browser-recorded voice memo. Manages MediaRecorder lifecycle, the
// analyser node that drives the live waveform strip, and the
// per-sample RMS capture that survives to become the "captured"
// waveform shown in the preview. Wraps the upload so callers get a
// server-side MediaAttachment ID out the far end.
//
// Extracted from the archived nudges/voices.tsx and generalised —
// max length + auto-upload behaviour are options, not hard-coded.
// The consumer can use this directly or drop in the ergonomic
// `<VoiceRecorder>` wrapper (components/media/voice_recorder.tsx).

export interface VoiceRecordingOptions {
  // Hard cap in seconds; recorder auto-stops on hitting it.
  // Defaults to 60 s (matches Moments video cap and the archived
  // Nudges recorder).
  maxSeconds?: number;
  // If true, the recorder auto-uploads on stop and the resolved
  // MediaAttachment ID lands in `mediaId`. Callers who want to defer
  // upload until submit (e.g. so a discarded recording never touches
  // the server) pass false and call `commitUpload()` themselves.
  // Defaults to true.
  autoUpload?: boolean;
}

export interface VoiceRecordingState {
  // Server-side MediaAttachment ID, once the upload resolves.
  // Undefined while recording, while upload is in flight, or after
  // a clear.
  mediaId: string | undefined;
  // The raw recorded Blob (webm/ogg/m4a depending on browser).
  // Useful for local preview via URL.createObjectURL.
  blob: Blob | undefined;
  // Object URL for `blob`, lifecycle-managed by this hook.
  blobUrl: string | undefined;
  // True while the browser MediaRecorder is active.
  recording: boolean;
  // Whole-second elapsed timer, updated once per second while
  // recording; freezes to the final length on stop.
  seconds: number;
  // Live amplitude bars sampled from the AnalyserNode during
  // recording. Empty when not recording.
  liveWaveform: number[];
  // Normalised amplitude bars captured across the recording,
  // resampled to WAVEFORM_BARS bars. Empty until stop.
  capturedWaveform: number[];
}

export interface VoiceRecordingControls {
  start: () => void;
  stop: () => void;
  // Clear any captured recording — undoes both blob + mediaId,
  // resets the timer, kills any in-flight preview playback.
  clear: () => void;
  // Force-upload the current blob if it hasn't been uploaded yet
  // (only meaningful when `autoUpload: false`). Resolves to the
  // MediaAttachment ID.
  commitUpload: () => Promise<string>;
}

export function useVoiceRecording(
  options: VoiceRecordingOptions = {},
): VoiceRecordingState & VoiceRecordingControls {
  const maxSeconds = options.maxSeconds ?? DEFAULT_MAX_SECONDS;
  const autoUpload = options.autoUpload ?? true;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const secondsRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const capturedSamplesRef = useRef<number[]>([]);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadPromiseRef = useRef<Promise<string> | null>(null);

  const [mediaId, setMediaId] = useState<string | undefined>();
  const [blob, setBlob] = useState<Blob | undefined>();
  const [blobUrl, setBlobUrl] = useState<string | undefined>();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [capturedWaveform, setCapturedWaveform] = useState<number[]>([]);

  // Manage blob object URL lifecycle so the consumer can `<audio src>`
  // it without wiring their own URL.createObjectURL / revoke pair.
  useEffect(() => {
    if (!blob) return undefined;
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setBlobUrl(undefined);
    };
  }, [blob]);

  // Full teardown on unmount — mic tracks, audio context,
  // animation frame, sample interval, elapsed-seconds timer.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      if (animationFrameRef.current !== null)
        cancelAnimationFrame(animationFrameRef.current);
      if (sampleIntervalRef.current !== null)
        clearInterval(sampleIntervalRef.current);
      void audioCtxRef.current?.close();
    },
    [],
  );

  const start = useCallback(() => {
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const mimeType =
          (
            [
              'audio/ogg;codecs=opus',
              'audio/mp4',
              'audio/webm;codecs=opus',
              'audio/webm',
            ] as const
          ).find((t) => MediaRecorder.isTypeSupported(t)) ?? 'audio/webm';

        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;

        // Live waveform strip — frequency data over the low 65% of
        // the spectrum reads best for voice (bass + mids; drops the
        // hiss-heavy top).
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const drawFrame = () => {
          analyser.getByteFrequencyData(freqData);
          const usable = Math.floor(freqData.length * 0.65);
          setLiveWaveform(
            Array.from({ length: WAVEFORM_BARS }, (_, i) => {
              const idx = Math.floor((i / WAVEFORM_BARS) * usable);
              return (freqData[idx] ?? 0) / 255;
            }),
          );
          animationFrameRef.current = requestAnimationFrame(drawFrame);
        };
        animationFrameRef.current = requestAnimationFrame(drawFrame);

        // Captured waveform — time-domain RMS sampled every
        // SAMPLE_INTERVAL_MS, later resampled down to WAVEFORM_BARS
        // for the preview.
        capturedSamplesRef.current = [];
        const timeData = new Uint8Array(analyser.fftSize);
        sampleIntervalRef.current = setInterval(() => {
          analyserRef.current?.getByteTimeDomainData(timeData);
          let sum = 0;
          for (const v of timeData) {
            const norm = v / 128 - 1;
            sum += norm * norm;
          }
          capturedSamplesRef.current.push(Math.sqrt(sum / timeData.length));
        }, SAMPLE_INTERVAL_MS);

        const recorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 128_000,
        });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => {
            t.stop();
          });

          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          if (sampleIntervalRef.current !== null) {
            clearInterval(sampleIntervalRef.current);
            sampleIntervalRef.current = null;
          }
          void audioCtxRef.current?.close();
          audioCtxRef.current = null;
          setLiveWaveform([]);

          const samples = capturedSamplesRef.current;
          const maxVal = Math.max(...samples, 0.001);
          const norm = samples.map((s) => s / maxVal);
          setCapturedWaveform(
            Array.from({ length: WAVEFORM_BARS }, (_, i) => {
              const t = norm.length <= 1 ? 0 : i / (WAVEFORM_BARS - 1);
              const si = Math.min(Math.floor(t * norm.length), norm.length - 1);
              return Math.max(0.08, norm[si] ?? 0.08);
            }),
          );

          const outBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          const capturedSeconds = secondsRef.current;
          setRecording(false);
          if (timerRef.current) clearInterval(timerRef.current);
          setBlob(outBlob);
          setSeconds(capturedSeconds);
          if (autoUpload) {
            uploadPromiseRef.current = uploadMediaBlob(outBlob).then((id) => {
              setMediaId(id);
              return id;
            });
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setRecording(true);
        setSeconds(0);
        secondsRef.current = 0;
        timerRef.current = setInterval(() => {
          setSeconds((s) => {
            const next = s + 1;
            secondsRef.current = next;
            if (next >= maxSeconds) recorder.stop();
            return next;
          });
        }, 1000);
      } catch {
        // mic permission denied — leave state as-is; consumer sees
        // `recording` never flip to true.
      }
    })();
  }, [autoUpload, maxSeconds]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const clear = useCallback(() => {
    setMediaId(undefined);
    setBlob(undefined);
    setSeconds(0);
    setCapturedWaveform([]);
    uploadPromiseRef.current = null;
  }, []);

  const commitUpload = useCallback(async () => {
    if (mediaId) return mediaId;
    if (uploadPromiseRef.current) return uploadPromiseRef.current;
    if (!blob) throw new Error('nothing to upload');
    const p = uploadMediaBlob(blob).then((id) => {
      setMediaId(id);
      return id;
    });
    uploadPromiseRef.current = p;
    return p;
  }, [blob, mediaId]);

  return {
    mediaId,
    blob,
    blobUrl,
    recording,
    seconds,
    liveWaveform,
    capturedWaveform,
    start,
    stop,
    clear,
    commitUpload,
  };
}
