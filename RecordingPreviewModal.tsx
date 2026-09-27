import type { RecordingPreview } from './useCanvasRecorder';

type Props = {
  preview: RecordingPreview;
  onClose: () => void;
};

export function RecordingPreviewModal({ preview, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Prévia da gravação</p>
            <p className="text-xs text-white/45">Somente câmera + prisma, sem a interface.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/15"
          >
            Fechar
          </button>
        </div>

        <div className="bg-black p-3">
          <video
            src={preview.url}
            controls
            playsInline
            className="max-h-[65dvh] w-full rounded-2xl bg-black object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-xs text-white/45">Formato: {preview.extension.toUpperCase()}</span>
          <a
            href={preview.url}
            download={`prisma-holografico-${Date.now()}.${preview.extension}`}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-[1.02] active:scale-[0.98]"
          >
            Baixar vídeo
          </a>
        </div>
      </div>
    </div>
  );
}
