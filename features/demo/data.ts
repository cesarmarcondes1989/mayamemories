// Conteúdo do "Baú da Alice" (demonstração). Tudo fictício; mídias ilustradas em public/demo.
// Datas relativas ao nascimento da Alice (12/05/2026).

export const DEMO_BIRTH = "2026-05-12";
export const DEMO_EMAILS = {
  admin: "demo.ana@demo.guardeipravoce.com.br",
  family: "demo.visitante@demo.guardeipravoce.com.br",
};

export type DemoPersonKey = "ana" | "visitante" | "rafael" | "lucia" | "nelson" | "beto" | "bia" | "clara" | "carol" | "jessica";

export const DEMO_PEOPLE: Array<{ key: DemoPersonKey; name: string; rel: string; guest?: boolean }> = [
  { key: "ana", name: "Ana (mamãe)", rel: "mae" },
  { key: "visitante", name: "Você (visitante)", rel: "amigo_familia" },
  { key: "rafael", name: "Rafael (papai)", rel: "pai" },
  { key: "lucia", name: "Vó Lúcia", rel: "avo" },
  { key: "nelson", name: "Vô Nelson", rel: "avo" },
  { key: "beto", name: "Tio Beto", rel: "tio" },
  { key: "bia", name: "Dinda Bia", rel: "padrinho" },
  { key: "clara", name: "Prima Clara", rel: "primo" },
  { key: "carol", name: "Carol", rel: "convidado", guest: true },
  { key: "jessica", name: "Jéssica", rel: "convidado", guest: true },
];

export type DemoMemory = {
  key: string;
  type: "photo" | "video" | "audio" | "text" | "letter" | "drawing" | "milestone";
  title: string;
  description?: string;
  by: DemoPersonKey;
  date: string;
  file?: string;
  status?: "approved" | "pending_review";
  highlight?: boolean;
  unlock?: string;
  recipient?: string;
  event?: "cha" | "aniversario";
};

export const DEMO_MEMORIES: DemoMemory[] = [
  { key: "ultrassom", type: "photo", title: "Primeiro ultrassom", by: "ana", date: "2025-11-20", file: "ultrassom.jpg", highlight: true,
    description: "12 semanas. Seu coração batendo a 158 por minuto. Seu pai segurou minha mão tão forte que doeu — e a gente chorou os dois." },
  { key: "barriga", type: "photo", title: "Barriga de 6 meses", by: "rafael", date: "2026-02-14", file: "barriga.jpg",
    description: "Dia dos namorados a três. Você chutou na hora da foto." },
  { key: "cha", type: "photo", title: "Chá de bebê", by: "bia", date: "2026-03-21", file: "cha.jpg", event: "cha",
    description: "A mesa mais rosa que já vi. Sua mãe não parou de sorrir um segundo." },
  { key: "cha-carol", type: "text", title: "Recado da Carol", by: "carol", date: "2026-03-21", event: "cha",
    description: "Alice, sua mãe foi minha dupla de faculdade. Se você tiver metade da risada dela, o mundo já ganhou. Beijo da tia Carol!" },
  { key: "quarto", type: "photo", title: "O quarto ficou pronto", by: "rafael", date: "2026-04-30", file: "quarto.jpg",
    description: "Montei o berço sozinho (com tutorial e 3 parafusos sobrando)." },
  { key: "nascimento", type: "milestone", title: "Bem-vinda, Alice!", by: "ana", date: "2026-05-12", file: "nascimento.jpg", highlight: true,
    description: "12 de maio, 6h42 da manhã. 3,2 kg e 49 cm de gente. O dia mais bonito das nossas vidas." },
  { key: "colo-vo", type: "photo", title: "O primeiro colo da vó", by: "lucia", date: "2026-05-14", file: "vo.jpg",
    description: "Esperei 9 meses por esse colo. Valeu cada dia." },
  { key: "banho", type: "photo", title: "Primeiro banho", by: "ana", date: "2026-05-20", file: "banho.jpg",
    description: "Você chorou, a gente riu. Depois você dormiu 4 horas seguidas (milagre)." },
  { key: "vo-cantando", type: "audio", title: "Vó Lúcia cantarolando", by: "lucia", date: "2026-05-28", file: "vo-cantando.mp3", highlight: true,
    description: "A mesma musiquinha que eu cantava pra sua mãe dormir. Agora é sua." },
  { key: "papai", type: "photo", title: "Plantão de madrugada", by: "rafael", date: "2026-06-03", file: "papai.jpg",
    description: "3h da manhã. Você no meu peito, eu fingindo que não estava com sono." },
  { key: "sorriso", type: "photo", title: "O primeiro sorriso", by: "ana", date: "2026-06-25", file: "sorriso.jpg", highlight: true,
    description: "Não foi gases. Foi sorriso de verdade, olhando pra mim." },
  { key: "risada", type: "video", title: "Alice dando risada", by: "beto", date: "2026-07-10", file: "risada.mp4",
    description: "Bastou eu fazer a voz do pato. Repeti 40 vezes, você riu as 40." },
  { key: "passeio", type: "photo", title: "Primeiro passeio no parque", by: "nelson", date: "2026-07-19", file: "passeio.jpg",
    description: "Empurrei o carrinho a manhã toda. Melhor caminhada da minha vida." },
  { key: "mes3", type: "photo", title: "Mesversário: 3 meses", by: "ana", date: "2026-08-12", file: "mes3.jpg" },
  { key: "tio", type: "photo", title: "Show particular do tio Beto", by: "beto", date: "2026-08-30", file: "tio.jpg",
    description: "Repertório: Galinha Pintadinha em versão acústica. Público: 1 bebê muito exigente." },
  { key: "caixinha", type: "audio", title: "Caixinha de música do quarto", by: "rafael", date: "2026-09-01", file: "caixinha.mp3",
    description: "O som que toca toda noite antes de você dormir." },
  { key: "desenho", type: "drawing", title: "Eu e a Alice", by: "clara", date: "2026-09-15", file: "desenho.jpg",
    description: "Desenho da prima Clara, 6 anos. Ela fez questão de colocar o sol." },
  { key: "bilhete-vo", type: "text", title: "Bilhete do vô", by: "nelson", date: "2026-09-20",
    description: "Alice, seu avô aqui. Ainda não sei mexer direito nisso, mas aprendi só pra te dizer: você tem os olhos da sua bisavó Zélia." },
  { key: "papinha", type: "photo", title: "Primeira papinha", by: "ana", date: "2026-10-05", file: "papinha.jpg",
    description: "Abóbora. Você fez cara feia, depois pediu mais." },
  // Cartas para o futuro (trancadas)
  { key: "carta-18", type: "letter", title: "Para você ler aos 18", by: "rafael", date: "2026-05-12", unlock: "2044-05-12", recipient: "Alice",
    description: "Filha, hoje você nasceu e eu prometi que ia te escrever uma carta pra quando você fosse adulta..." },
  { key: "carta-15", type: "letter", title: "Quando você fizer 15", by: "bia", date: "2026-06-01", unlock: "2041-05-12", recipient: "Alice",
    description: "Afilhada, aos 15 tudo parece enorme. Deixa eu te contar um segredo da sua mãe..." },
  { key: "carta-1", type: "letter", title: "No seu primeiro aniversário", by: "lucia", date: "2026-05-14", unlock: "2027-05-12", recipient: "Alice",
    description: "Minha neta, um ano! Quando você ler isso (com a ajuda da mamãe), saiba que a vó estava lá." },
  // Para o painel da administradora (aguardando aprovação)
  { key: "pend-domingo", type: "photo", title: "Domingo na casa da vó", by: "lucia", date: "2026-10-12", file: "vo.jpg", status: "pending_review",
    description: "Fiz o bolo de fubá que sua mãe gostava." },
  { key: "pend-jessica", type: "text", title: "Recado da Jéssica", by: "jessica", date: "2026-10-14", status: "pending_review", event: "aniversario",
    description: "Já reservei a data do seu primeiro aniversário! Mal posso esperar, Alice." },
];

export const DEMO_COMMENTS: Array<{ on: string; by: DemoPersonKey; body: string }> = [
  { on: "nascimento", by: "lucia", body: "Linda demais! Chorei o dia inteiro 😭" },
  { on: "nascimento", by: "beto", body: "Bem-vinda, sobrinha! O tio vai te ensinar tudo que sua mãe não deixa." },
  { on: "sorriso", by: "beto", body: "Esse sorriso puxou o tio, certeza." },
  { on: "vo-cantando", by: "bia", body: "Chorei ouvindo, vó. Que presente." },
  { on: "risada", by: "ana", body: "Eu assisto isso todo dia antes de dormir 🥹" },
];

export const DEMO_VISITS: Array<{ by: DemoPersonKey; date: string; type: string; message: string; status?: string }> = [
  { by: "lucia", date: "2026-05-13", type: "maternity", message: "Levei a manta de crochê que fiz durante a gravidez." },
  { by: "beto", date: "2026-06-10", type: "home", message: "Primeira visita oficial do tio. Trouxe o violão." },
  { by: "nelson", date: "2026-07-19", type: "outing", message: "Passeio no parque com a vovó e a mamãe." },
  { by: "bia", date: "2026-10-10", type: "home", message: "Tarde de colo e fofoca com a mamãe.", status: "pending_review" },
];

export const DEMO_CAPSULES: Array<{ title: string; description: string; theme: string; type: string; status: string; opens?: string; items: string[] }> = [
  { title: "Cápsula Zero — A espera", description: "Da gestação ao nascimento: a expectativa da família.", theme: "O que estávamos vivendo",
    type: "pregnancy", status: "opened", items: ["ultrassom", "barriga", "cha", "quarto"] },
  { title: "Cápsula do nascimento", description: "Primeiras fotos, primeiros sons, a primeira visita.", theme: "Quem estava por perto",
    type: "birth", status: "opened", items: ["nascimento", "colo-vo", "banho", "vo-cantando"] },
  { title: "Primeiro aniversário", description: "Abre sozinha no dia em que a Alice fizer 1 ano.", theme: "O primeiro ano inteiro",
    type: "growth", status: "scheduled", opens: "2027-05-12", items: ["carta-1", "sorriso", "risada"] },
  { title: "Cartas para os 18", description: "Cartas escritas hoje, para a Alice abrir adulta.", theme: "O que desejamos para você",
    type: "letters", status: "scheduled", opens: "2044-05-12", items: ["carta-18", "carta-15"] },
];
