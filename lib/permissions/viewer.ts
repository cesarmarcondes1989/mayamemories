import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { POLICY_VERSION } from "@/lib/constants";

export type Viewer = {
  userId: string;
  email: string | null;
  profileId: string | null;
  displayName: string;
  personId: string | null;
  roles: string[];
  isAdmin: boolean;
  canContribute: boolean;
  hasConsent: boolean;
};

/**
 * Identidade do usuário atual. Os papéis vêm do banco (RLS: só o próprio),
 * nunca de metadados editáveis pelo navegador. Serve para decidir a
 * NAVEGAÇÃO; a autorização real continua no banco.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, status")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  let personId: string | null = null;
  let roles: string[] = [];
  let hasConsent = false;
  if (profile && profile.status === "active") {
    const [{ data: person }, { data: roleRows }, { data: consent }] = await Promise.all([
      supabase.from("people").select("id, status").eq("profile_id", profile.id).maybeSingle(),
      supabase.from("person_roles").select("role").eq("profile_id", profile.id).is("revoked_at", null),
      supabase.rpc("has_active_consent", { p_type: "contribution_terms", p_version: POLICY_VERSION }),
    ]);
    personId = person?.status === "active" ? person.id : null;
    roles = (roleRows ?? []).map((r) => r.role as string);
    hasConsent = Boolean(consent);
  }

  const isAdmin = roles.includes("admin") && personId !== null;
  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    profileId: profile?.id ?? null,
    displayName: profile?.display_name ?? "",
    personId,
    roles,
    isAdmin,
    canContribute: personId !== null && (isAdmin || roles.includes("contributor")),
    hasConsent,
  };
});

/** Exige um participante ativo (contribuinte, admin ou Maya). */
export async function requireMember(opts: { needsConsent?: boolean } = {}): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  if (!viewer.personId || viewer.roles.length === 0) redirect("/acesso-indisponivel?motivo=sem-convite");
  if (opts.needsConsent !== false && !viewer.hasConsent && !viewer.isAdmin) redirect("/boas-vindas");
  return viewer;
}

export async function requireContributor(): Promise<Viewer> {
  const viewer = await requireMember();
  if (!viewer.canContribute) redirect("/inicio");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=/admin");
  if (!viewer.isAdmin) redirect("/inicio");
  return viewer;
}
