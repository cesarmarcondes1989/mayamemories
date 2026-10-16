// Incentivos carinhosos: provocam pela curiosidade, nunca pela culpa.
// Sem ranking, sem comparação com outras pessoas.

export type MemoryStats = {
  enabled: boolean;
  subject_name: string;
  birth_date: string | null;
  expected_birth_date: string | null;
  my_total: number;
  my_approved: number;
  my_last_at: string | null;
  my_last_photo_at: string | null;
  my_last_audio_at: string | null;
  my_letters: number;
  my_visits: number;
  family_total: number;
  next_capsule: { id: string; title: string; opens_at: string } | null;
};

export type Nudge = { text: string; cta: { href: string; label: string } };

const DAY = 86_400_000;

export function daysBetween(from: string | Date, to: Date): number {
  const a = typeof from === "string" ? new Date(from.length === 10 ? `${from}T12:00:00-03:00` : from) : from;
  return Math.floor((to.getTime() - a.getTime()) / DAY);
}

/** “A Maya tem 47 dias” / “Faltam 30 dias para a Maya chegar”. */
export function subjectCounter(s: MemoryStats, now = new Date()): string | null {
  const name = s.subject_name || "Maya";
  if (s.birth_date) {
    const d = daysBetween(s.birth_date, now);
    if (d >= 0) {
      if (d === 0) return `A ${name} nasceu **hoje** 💗`;
      if (d < 730) return `A ${name} tem **${d} ${d === 1 ? "dia" : "dias"} de vida**`;
      return `A ${name} tem **${Math.floor(d / 365)} anos**`;
    }
  }
  if (s.expected_birth_date) {
    const d = -daysBetween(s.expected_birth_date, now);
    if (d > 0) return `Faltam **${d} ${d === 1 ? "dia" : "dias"}** para a ${name} chegar`;
  }
  return null;
}

const SEND_PHOTO = { href: "/enviar/foto", label: "Enviar uma foto" };
const RECORD = { href: "/enviar/audio", label: "Gravar agora" };
const LETTER = { href: "/cartas/nova", label: "Escrever carta" };
const WRITE = { href: "/enviar/mensagem", label: "Escrever" };

/** Escolhe UMA mensagem. `seed` (0..1) faz a mensagem variar a cada visita. */
export function pickNudge(s: MemoryStats, now = new Date(), seed = Math.random()): Nudge {
  const name = s.subject_name || "Maya";
  const options: Nudge[] = [];

  if (s.next_capsule) {
    const left = Math.max(0, -daysBetween(s.next_capsule.opens_at, now));
    if (left <= 30) {
      options.push({
        text: `Faltam **${left} ${left === 1 ? "dia" : "dias"}** para abrir “${s.next_capsule.title}”. Deixa uma carta lá dentro?`,
        cta: LETTER,
      });
    }
  }

  if (s.my_total === 0) {
    return {
      text: `Sua primeira lembrança pra ${name} ainda está em branco. Que tal uma foto de hoje?`,
      cta: SEND_PHOTO,
    };
  }

  const since = s.my_last_at ? daysBetween(s.my_last_at, now) : null;
  if (since !== null && since >= 7) {
    options.push(
      { text: `**${since} dias** sem notícias suas… a ${name} mudou um monte desde então. O que você viu de novo?`, cta: SEND_PHOTO },
      { text: `Daqui a 15 anos ela vai querer saber como foi esse mês. Conta pra ela? (faz **${since} dias** da sua última lembrança)`, cta: WRITE },
    );
  }
  const photoSince = s.my_last_photo_at ? daysBetween(s.my_last_photo_at, now) : null;
  if (photoSince === null || photoSince >= 14) {
    options.push({
      text: photoSince === null ? `Você ainda não mandou nenhuma foto pra ${name}. Tem alguma aí na galeria? 📷` : `Faz **${photoSince} dias** desde a sua última foto. Bora registrar o hoje? 📷`,
      cta: SEND_PHOTO,
    });
  }
  if (!s.my_last_audio_at) {
    options.push({ text: `A ${name} ainda não conhece a sua voz por aqui. Grava 30 segundinhos pra ela? 🎙️`, cta: RECORD });
  }
  if (s.my_letters === 0) {
    options.push({ text: `Uma carta sua pra ${name} abrir aos 15 anos. Imagina a cara dela lendo… ✉️`, cta: LETTER });
  }
  options.push(
    { text: `Você já guardou **${s.my_total} ${s.my_total === 1 ? "lembrança" : "lembranças"}** pra ${name}. Que tal mais uma hoje? ♡`, cta: SEND_PHOTO },
    { text: `Qual é a coisa que você mais quer que a ${name} saiba sobre você? Escreve pra ela.`, cta: WRITE },
  );
  return options[Math.min(options.length - 1, Math.floor(seed * options.length))];
}

/** Divide “**negrito**” em partes para renderizar sem HTML cru. */
export function boldParts(text: string): Array<{ text: string; bold: boolean }> {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) =>
    p.startsWith("**") ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false },
  );
}
