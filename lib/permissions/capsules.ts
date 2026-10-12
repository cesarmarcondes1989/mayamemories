// Espelho (somente para exibição) da regra de abertura avaliada no banco.
// A AUTORIZAÇÃO real acontece em public.capsule_is_open() a cada consulta.

export type CapsuleLike = {
  status: string;
  opening_rule: string;
  opens_at: string | null;
  opened_at: string | null;
};

export function capsuleConditionMet(c: CapsuleLike, now = new Date()): boolean {
  const dateReached = c.opens_at !== null && new Date(c.opens_at).getTime() <= now.getTime();
  switch (c.opening_rule) {
    case "date":
      return dateReached;
    case "manual":
      return c.opened_at !== null;
    case "date_and_manual":
      return dateReached && c.opened_at !== null;
    default:
      return false;
  }
}

export function capsuleIsOpen(c: CapsuleLike, now = new Date()): boolean {
  return ["scheduled", "eligible_to_open", "opened"].includes(c.status) && capsuleConditionMet(c, now);
}

export type CapsuleDisplayState = "draft" | "waiting" | "ready_for_authorization" | "open" | "sealed" | "archived";

export function capsuleDisplayState(c: CapsuleLike, now = new Date()): CapsuleDisplayState {
  if (c.status === "draft") return "draft";
  if (c.status === "archived") return "archived";
  if (c.status === "sealed") return "sealed";
  if (capsuleIsOpen(c, now)) return "open";
  const dateReached = c.opens_at !== null && new Date(c.opens_at).getTime() <= now.getTime();
  if (c.opening_rule === "date_and_manual" && dateReached) return "ready_for_authorization";
  if (c.opening_rule === "manual") return "ready_for_authorization";
  return "waiting";
}

export const CAPSULE_STATE_LABELS: Record<CapsuleDisplayState, string> = {
  draft: "Em montagem",
  waiting: "Guardada",
  ready_for_authorization: "Aguardando os pais",
  open: "Aberta",
  sealed: "Lacrada",
  archived: "Arquivada",
};

/** Idade da Maya em uma data, para sugerir aberturas ("quando ela fizer 15 anos"). */
export function dateAtAge(birth: string, years: number, months = 0): string {
  const [y, m, d] = birth.split("-").map(Number);
  const target = new Date(Date.UTC(y + years, m - 1 + months, d));
  return target.toISOString().slice(0, 10);
}
