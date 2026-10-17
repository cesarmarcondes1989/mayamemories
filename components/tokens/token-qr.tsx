import { qrSvg } from "@/lib/qr";

/** QR do token + atalhos para baixar e imprimir. */
export async function TokenQr({ tokenId, url, personal }: { tokenId: string; url: string; personal: boolean }) {
  const svg = await qrSvg(url);
  return (
    <details className="group mt-3 rounded-2xl border border-line bg-paper">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-rose-deep">
        <span aria-hidden="true">▦</span> QR code <span className="text-taupe group-open:hidden">· mostrar</span>
      </summary>
      <div className="flex flex-wrap items-center gap-4 px-3 pb-3">
        {/* SVG gerado no servidor a partir da nossa própria URL */}
        <div className="size-36 shrink-0 rounded-xl bg-white p-1" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/tokens/${tokenId}/qr`} className="inline-flex h-9 items-center rounded-full bg-rose-deep px-4 font-semibold text-white">
              Baixar PNG
            </a>
            <a href={`/admin/tokens/${tokenId}/qr?formato=svg`} className="inline-flex h-9 items-center rounded-full border border-rose/70 bg-paper px-4 font-semibold text-rose-deep">
              SVG
            </a>
            <a href={`/imprimir/token/${tokenId}`} target="_blank" className="inline-flex h-9 items-center rounded-full border border-rose/70 bg-paper px-4 font-semibold text-rose-deep">
              🖨️ Cartão para imprimir
            </a>
          </div>
          <p className="max-w-xs text-xs text-taupe">
            {personal
              ? "Este QR é a chave desta pessoa: quem escanear entra como ela. Entregue só para ela."
              : "Pode ficar na mesa: cada convidado escaneia, diz o nome e entra no álbum do evento."}
          </p>
        </div>
      </div>
    </details>
  );
}
