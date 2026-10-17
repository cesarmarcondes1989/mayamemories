// Quem entra pelo ursinho ou pela mesa do evento ganha um e-mail interno
// (nunca recebe mensagens). Depois a pessoa pode trocar por um e-mail real.
const PLACEHOLDER = /^(nfc|guest)-[0-9a-f-]{8,}@/i;

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || PLACEHOLDER.test(email);
}

export function guestPlaceholderEmail(host: string): string {
  return `guest-${crypto.randomUUID()}@${host}`;
}
export const EMAIL_PROMPT_SKIP_COOKIE = "mm_email_skip";
