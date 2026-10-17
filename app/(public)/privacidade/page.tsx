import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl pt-4">
      <h1 className="text-5xl">Privacidade e cuidado</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink/90">
        <p>
          O Maya Memories é um arquivo de família privado. Ele guarda dados e imagens de uma criança e, por isso, foi
          desenhado para minimizar riscos desde a primeira versão, em linha com a LGPD e com os direitos da criança e do
          adolescente.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Nada é publicado automaticamente: toda contribuição é revisada por quem cuida do baú.</li>
          <li>Fotos, vídeos e áudios ficam em armazenamento privado e são exibidos por links temporários.</li>
          <li>As páginas não são indexadas por mecanismos de busca e não há compartilhamento em redes sociais.</li>
          <li>Não há publicidade, rastreamento comportamental nem coleta de dados sem finalidade definida.</li>
          <li>Você pode consultar, corrigir e pedir a exclusão do que enviou, e retirar consentimentos a qualquer momento.</li>
          <li>Acessos administrativos relevantes são registrados em log de auditoria.</li>
          <li>À medida que crescer, a própria criança ganhará autonomia sobre a sua história.</li>
        </ul>
        <p>Dúvidas ou pedidos: fale diretamente com quem cuida do baú.</p>
      </div>
    </article>
  );
}
