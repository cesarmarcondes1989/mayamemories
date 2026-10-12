// Vocabulário do produto — fonte única para rótulos da interface.

export const POLICY_VERSION = "2026-10-v1";

export const MEMORY_TYPE_LABELS: Record<string, string> = {
  photo: "Foto",
  album: "Álbum de fotos",
  video: "Vídeo",
  audio: "Áudio",
  text: "Mensagem",
  letter: "Carta para o futuro",
  visit: "Visita",
  milestone: "Marco importante",
  drawing: "Desenho ou documento",
  mixed: "Memória com vários arquivos",
};

export const VISIBILITY_OPTIONS = [
  { value: "family", label: "Família autorizada", hint: "Pessoas do grupo da família poderão ver." },
  { value: "private", label: "Privado", hint: "Somente os pais da Maya (e quem eles autorizarem)." },
  { value: "capsule", label: "Guardar para uma cápsula", hint: "Só aparece quando a cápsula for aberta." },
  { value: "selected", label: "Participantes selecionados", hint: "Os pais escolherão quem poderá ver." },
] as const;

export const VISIBILITY_LABELS: Record<string, string> = {
  family: "Família autorizada",
  private: "Privado",
  capsule: "Cápsula futura",
  selected: "Participantes selecionados",
  public: "Público (desativado)",
};

export const MODERATION_LABELS: Record<string, { label: string; tone: "neutral" | "pending" | "ok" | "warn" | "error" }> = {
  draft: { label: "Rascunho", tone: "neutral" },
  uploading: { label: "Enviando arquivos", tone: "pending" },
  processing: { label: "Processando", tone: "pending" },
  pending_review: { label: "Aguardando aprovação", tone: "pending" },
  approved: { label: "Aprovada", tone: "ok" },
  changes_requested: { label: "Ajuste solicitado", tone: "warn" },
  rejected: { label: "Não publicada", tone: "error" },
  hidden: { label: "Oculta", tone: "neutral" },
  removed: { label: "Removida", tone: "neutral" },
};

export const VISIT_TYPES = [
  { value: "home", label: "Visita em casa" },
  { value: "maternity", label: "Maternidade" },
  { value: "outing", label: "Passeio" },
  { value: "family_gathering", label: "Encontro em família" },
  { value: "celebration", label: "Festa ou comemoração" },
  { value: "other", label: "Outro" },
] as const;

export const VISIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(VISIT_TYPES.map((v) => [v.value, v.label]));

export const CAPSULE_TYPE_LABELS: Record<string, string> = {
  pregnancy: "Gestação",
  birth: "Nascimento",
  growth: "Crescimento",
  letters: "Cartas",
  special: "Especial",
  fifteen: "15 anos",
};

export const OPENING_RULE_LABELS: Record<string, string> = {
  date: "Abre automaticamente na data",
  manual: "Abertura manual pelos pais",
  date_and_manual: "Data + autorização dos pais",
};

export const NFC_STATUS_LABELS: Record<string, string> = {
  prepared: "Preparado",
  active: "Ativo",
  suspended: "Suspenso",
  revoked: "Revogado",
  replaced: "Substituído",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  contributor: "Contribuinte",
  future_subject: "Maya (acesso futuro)",
};
