import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { drawPrism } from './drawPrism';
import { buildPrismGeometry } from './prismGeometry';
import { ThermalShaderRenderer } from './ThermalShaderRenderer';
import { useCanvasRecorder } from './useCanvasRecorder';
import { useMediaPipeHands } from './useMediaPipeHands';
import type { PrismMode } from './prism';
import { RecordingPreviewModal } from './RecordingPreviewModal';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const MODE_LABEL: Record<PrismMode, string> = {
  none: 'Mostre 1 ou 2 mãos',
  book: 'Prisma dobrável',
  pyramid: 'Pirâmide 3D',
  'inverted-pyramid': 'Pirâmide invertida',
  diamond: 'Lente diamante',
};

export function HolographicPrismCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ThermalShaderRenderer | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [renderFps, setRenderFps] = useState(0);
  const [mode, setMode] = useState<PrismMode>('none');

  const { handsRef, ready: trackerReady, error: trackerError, inferenceFps } = useMediaPipeHands(videoRef);
  const {
    recording,
    elapsedMs,
    preview,
    error: recordingError,
    startRecording,
    stopRecording,
    revokePreview,
  } = useCanvasRecorder(canvasRef);

  const statusError = cameraError ?? trackerError ?? recordingError;

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 60, max: 60 },
        },
      });
      cameraStreamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (cause) {
      setCameraReady(false);
      setCameraError(
        cause instanceof Error
          ? `${cause.message}. Libere a câmera e use HTTPS/localhost.`
          : 'Não foi possível acessar a câmera.',
      );
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [startCamera]);

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    let frames = 0;
    let fpsWindow = performance.now();
    let lastMode: PrismMode = 'none';

    try {
      shaderRef.current = new ThermalShaderRenderer();
    } catch (cause) {
      setCameraError(cause instanceof Error ? cause.message : 'WebGL2 indisponível.');
      return;
    }

    const render = (now: number) => {
      if (disposed) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const shader = shaderRef.current;

      if (video && canvas && shader && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          shader.resize(width, height);
        }

        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (ctx) {
          ctx.save();
          ctx.setTransform(-1, 0, 0, 1, width, 0);
          ctx.drawImage(video, 0, 0, width, height);
          ctx.restore();

          const geometry = buildPrismGeometry(handsRef.current, width, height);
          shader.render(video, geometry.opticalCenter, geometry.fold, now);
          drawPrism(ctx, shader.canvas, geometry);

          if (geometry.mode !== lastMode) {
            lastMode = geometry.mode;
            setMode(geometry.mode);
          }
        }

        frames += 1;
        if (now - fpsWindow >= 1000) {
          setRenderFps(Math.round((frames * 1000) / (now - fpsWindow)));
          frames = 0;
          fpsWindow = now;
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      shaderRef.current?.dispose();
      shaderRef.current = null;
    };
  }, [handsRef]);

  const readiness = useMemo(() => {
    if (!cameraReady) return 'Câmera…';
    if (!trackerReady) return 'MediaPipe…';
    return 'Pronto';
  }, [cameraReady, trackerReady]);

  return (
    <main className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white">
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute h-px w-px opacity-0" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover" />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.24),transparent_18%,transparent_74%,rgba(0,0,0,.52))]" />

      <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${trackerReady && cameraReady ? 'bg-emerald-400' : 'bg-amber-300'}`} />
            <span className="text-xs font-semibold">{readiness}</span>
          </div>
          <div className="mt-1 flex gap-3 text-[10px] text-white/50">
            <span>Render {renderFps} FPS</span>
            <span>Hands {inferenceFps} FPS</span>
          </div>
        </div>

        <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold backdrop-blur-xl">
          {MODE_LABEL[mode]}
        </div>
      </div>

      {!cameraReady && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-zinc-950/90 p-6 text-center backdrop-blur-xl">
          <div className="max-w-sm">
            <div className="mx-auto mb-5 h-20 w-20 rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-300/15 via-fuchsia-400/10 to-yellow-300/10 shadow-[0_0_50px_rgba(0,240,255,.16)]" />
            <h1 className="text-2xl font-black tracking-tight">Prisma Holográfico 3D</h1>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Mostre polegar + indicador. Com duas mãos, aproxime os indicadores no topo ou os polegares na base para trocar de forma.
            </p>
            <button
              type="button"
              onClick={() => void startCamera()}
              className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-black text-black transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Ativar câmera
            </button>
            {statusError && <p className="mt-4 text-xs leading-5 text-red-300">{statusError}</p>}
          </div>
        </div>
      )}

      {cameraReady && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {statusError && (
            <div className="max-w-md rounded-2xl border border-red-300/15 bg-red-950/45 px-4 py-2 text-center text-xs text-red-100 backdrop-blur-xl">
              {statusError}
            </div>
          )}

          <button
            type="button"
            disabled={!trackerReady}
            onClick={recording ? stopRecording : startRecording}
            className={`flex min-w-44 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-black shadow-2xl backdrop-blur-xl transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              recording
                ? 'border-red-300/30 bg-red-500 text-white shadow-red-500/20'
                : 'border-white/15 bg-black/45 text-white hover:bg-black/60'
            }`}
          >
            <span className={`h-2.5 w-2.5 ${recording ? 'animate-pulse rounded-sm bg-white' : 'rounded-full bg-red-500'}`} />
            {recording ? `REC ${formatTime(elapsedMs)}` : 'Gravar Vídeo'}
          </button>
          <p className="text-center text-[10px] font-medium text-white/45">
            A gravação captura apenas câmera + efeito. A interface fica fora do arquivo.
          </p>
        </div>
      )}

      {preview && <RecordingPreviewModal preview={preview} onClose={revokePreview} />}
    </main>
  );
}
