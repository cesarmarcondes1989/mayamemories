// Tutoriais (passo a passo + vídeo gravado no Baú da Alice).
// `video`: arquivo em public/tutoriais (gerado por marketing/tutorials/record.mjs,
// que também atualiza tutorials-videos.json com os que já foram gravados).
import recorded from "./tutorials-videos.json";

export type Tutorial = {
  slug: string;
  icon: string;
  title: string;
  who: "família" | "mãe/pai";
  summary: string;
  steps: string[];
  tryAt: { como: "familia" | "admin"; path: string };
  video?: string;
};

const BASE: Tutorial[] = [
  {
    slug: "conhecendo", icon: "🧸", who: "família", title: "Conhecendo o baú",
    summary: "O que avós, tios e padrinhos veem quando entram.",
    steps: [
      "Encoste o celular no ursinho (ou leia o QR). Você entra direto, sem senha.",
      "Na página inicial aparecem atalhos para guardar uma foto, um áudio ou uma carta.",
      "Em Linha do tempo estão as memórias aprovadas, em ordem. Toque numa para ver, ouvir e comentar.",
      "Em Cápsulas você vê as que já abriram e quando as outras vão abrir.",
    ],
    tryAt: { como: "familia", path: "/linha-do-tempo" },
  },
  {
    slug: "enviando", icon: "📸", who: "família", title: "Guardando uma memória",
    summary: "Foto, vídeo, áudio ou recado em menos de um minuto.",
    steps: [
      "Toque em Enviar foto (ou Áudio / Mensagem).",
      "Escolha do celular ou tire na hora. Dá para mandar várias de uma vez.",
      "Escreva um título e conte o que aconteceu. Corrija a data do momento, se precisar.",
      "Toque em Enviar com carinho. Quem cuida do baú aprova e a memória entra na linha do tempo.",
    ],
    tryAt: { como: "familia", path: "/enviar/foto" },
  },
  {
    slug: "cartas", icon: "✉️", who: "família", title: "Escrevendo uma carta para o futuro",
    summary: "Uma carta que fica trancada até os 15, os 18 ou a data que você escolher.",
    steps: [
      "Toque em Cartas e depois em Escrever carta.",
      "Escolha quando ela pode ser aberta (ex.: quando fizer 18 anos).",
      "Escreva sem pressa. Até a data, ninguém lê — nem quem escreveu.",
    ],
    tryAt: { como: "familia", path: "/cartas" },
  },
  {
    slug: "aprovando", icon: "✅", who: "mãe/pai", title: "Aprovando o que a família mandou",
    summary: "Nada aparece no baú sem você ver antes.",
    steps: [
      "No painel, Aprovação mostra o que está esperando.",
      "Aprove, peça ajuste ou esconda. Dá para aprovar vários de uma vez.",
      "Comentários e visitas também passam por aqui.",
    ],
    tryAt: { como: "admin", path: "/admin/aprovacao" },
  },
  {
    slug: "familia", icon: "👵", who: "mãe/pai", title: "Chamando a família (ursinho e QR)",
    summary: "Cadastre as pessoas e entregue a chave de cada uma.",
    steps: [
      "Em Pessoas, cadastre quem vai participar (nome e relação).",
      "Em Tokens NFC, crie o token da pessoa. Grave no ursinho ou imprima o QR.",
      "O QR de pessoa é a chave dela: entregue só para ela. Perdeu? Substitua na hora.",
    ],
    tryAt: { como: "admin", path: "/admin/tokens" },
  },
  {
    slug: "eventos", icon: "🎉", who: "mãe/pai", title: "Eventos com token de mesa",
    summary: "Chá de bebê, 1 ano, batizado: convidados mandam fotos pelo QR da mesa.",
    steps: [
      "Em Eventos, crie o evento (ex.: 1 ano da Alice).",
      "Já sai um token de mesa: imprima o cartão com o QR e coloque nas mesas.",
      "O convidado escaneia, diz o nome e manda fotos e recados. Ele vê só o álbum do evento.",
    ],
    tryAt: { como: "admin", path: "/admin/eventos" },
  },
  {
    slug: "exportando", icon: "💾", who: "mãe/pai", title: "Baixando tudo (ZIP)",
    summary: "Uma cópia completa, com uma página que abre sem internet.",
    steps: [
      "Em Exportação, toque em Baixar.",
      "Baús grandes vêm em partes: baixe todas e extraia na mesma pasta.",
      "Abra o index.html: a história inteira, com fotos, vídeos e áudios.",
    ],
    tryAt: { como: "admin", path: "/admin/exportacao" },
  },
];

const withVideo = new Set<string>(recorded as string[]);
export const TUTORIALS: Tutorial[] = BASE.map((t) => (withVideo.has(t.slug) ? { ...t, video: `${t.slug}.mp4` } : t));
