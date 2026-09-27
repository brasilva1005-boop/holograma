import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type RecordingPreview = {
  url: string;
  mimeType: string;
  extension: 'mp4' | 'webm';
};

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=h264',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function chooseMimeType(): string {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function useCanvasRecorder(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [preview, setPreview] = useState<RecordingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revokePreview = useCallback(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }, []);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setError(null);
    revokePreview();

    try {
      const stream = canvas.captureStream(60);
      streamRef.current = stream;
      chunksRef.current = [];

      const selectedMime = chooseMimeType();
      const recorder = new MediaRecorder(
        stream,
        selectedMime
          ? { mimeType: selectedMime, videoBitsPerSecond: 12_000_000 }
          : { videoBitsPerSecond: 12_000_000 },
      );
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError('O navegador interrompeu a gravação.');
      };

      recorder.onstop = () => {
        stopTimer();
        const mimeType = recorder.mimeType || selectedMime || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const extension: 'mp4' | 'webm' = mimeType.includes('mp4') ? 'mp4' : 'webm';
        setPreview({ url, mimeType, extension });
        setRecording(false);
        setElapsedMs(0);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
      };

      startedAtRef.current = performance.now();
      setElapsedMs(0);
      setRecording(true);
      recorder.start(1000);
      timerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current);
      }, 100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a gravação.');
    }
  }, [canvasRef, revokePreview]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  return {
    recording,
    elapsedMs,
    preview,
    error,
    startRecording,
    stopRecording,
    revokePreview,
  };
}
