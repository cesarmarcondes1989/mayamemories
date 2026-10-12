import type { MediaAsset } from "@/features/memories/queries";

/** Player de áudio/vídeo e visualizador de fotos (URLs assinadas e temporárias). */
export function MediaView({ asset, compact = false }: { asset: MediaAsset; compact?: boolean }) {
  if (!asset.url) {
    return <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-cream text-sm text-taupe">Arquivo indisponível</div>;
  }
  if (asset.media_type === "image" || (asset.media_type === "document" && asset.mime_type.startsWith("image/"))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={compact ? "aspect-[4/3] w-full object-cover" : "max-h-[80dvh] w-full rounded-2xl object-contain"}
      />
    );
  }
  if (asset.media_type === "video") {
    return (
      <video
        src={asset.url}
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload"
        className={compact ? "aspect-[4/3] w-full bg-ink object-cover" : "max-h-[80dvh] w-full rounded-2xl bg-ink"}
      />
    );
  }
  if (asset.media_type === "audio") {
    return (
      <div className={compact ? "bg-rose-soft/60 p-4" : "rounded-2xl bg-rose-soft/60 p-5"}>
        <p className="mb-2 text-sm text-taupe">🎙️ Mensagem de voz</p>
        <audio src={asset.url} controls preload="metadata" className="w-full" />
      </div>
    );
  }
  return (
    <a href={asset.url} target="_blank" rel="noreferrer noopener" className="block rounded-2xl border border-line bg-paper p-4 text-sm underline">
      📄 {asset.original_filename ?? "Abrir documento"}
    </a>
  );
}
