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
          <li>Não há publicidade nem rastreamento comportamental dentro dos baús.</li>
          <li>Você pode consultar, corrigir e pedir a exclusão do que enviou, e retirar consentimentos a qualquer momento.</li>
          <li>Acessos administrativos relevantes são registrados em log de auditoria.</li>
          <li>À medida que crescer, a própria criança ganhará autonomia sobre a sua história.</li>
        </ul>
        <h2 className="pt-4 text-3xl">Estatísticas do site público</h2>
        <p>
          Na vitrine (página inicial, planos e formulário) contamos visitas para entender como as pessoas chegam até
          aqui: página vista, de onde veio (ex.: Instagram ou um link de campanha), tipo de aparelho, navegador e região
          aproximada (estado e cidade). <strong>Não guardamos seu IP</strong> e nada disso é vendido ou usado para anúncios.
        </p>
        <p>
          Se você aceitar os cookies, o site lembra um identificador aleatório neste navegador para saber se é a mesma
          visita voltando. Se escolher “Só o essencial”, nada fica guardado e contamos apenas números anônimos. Para mudar
          de ideia, limpe os dados do site no navegador. Os registros brutos são apagados após 13 meses.
        </p>
        <p>O conteúdo dos baús das famílias nunca entra nessas estatísticas.</p>
        <p>Dúvidas ou pedidos: fale diretamente com quem cuida do baú.</p>
      </div>
    </article>
  );
}
