// Tradução de erros técnicos para mensagens acolhedoras.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const KNOWN: Array<[RegExp, string]> = [
  [/uploads still in progress/i, "Ainda há arquivos sendo enviados. Aguarde um instante."],
  [/needs at least one file/i, "Escolha pelo menos um arquivo."],
  [/message is empty/i, "Escreva sua mensagem antes de enviar."],
  [/media is not ready/i, "Os arquivos desta memória ainda não foram verificados."],
  [/invitation invalid or expired/i, "Este convite não está mais disponível."],
  [/another e-mail/i, "Este convite foi feito para outro e-mail."],
  [/already linked to another/i, "Este convite já foi usado por outra conta."],
  [/cannot be opened before its date|opens automatically/i, "Esta cápsula só pode ser aberta na data definida."],
  [/at least one administrator/i, "É preciso manter pelo menos um administrador."],
  [/own admin role|suspend yourself/i, "Você não pode remover o seu próprio acesso administrativo."],
  [/birth date/i, "Defina a data de nascimento (ou prevista) nas configurações."],
  [/forbidden|row-level security|permission denied|not editable/i, "Você não tem permissão para esta ação."],
  [/duplicate key/i, "Este item já existe."],
];

export function friendlyError(error: unknown, fallback = "Algo não saiu como esperado. Tente novamente."): string {
  const message =
    typeof error === "string" ? error : error && typeof error === "object" && "message" in error ? String(error.message) : "";
  for (const [pattern, text] of KNOWN) {
    if (pattern.test(message)) return text;
  }
  if (message) console.error("[maya-memories]", message);
  return fallback;
}
