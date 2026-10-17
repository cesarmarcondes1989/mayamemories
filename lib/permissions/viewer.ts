import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { POLICY_VERSION } from "@/lib/constants";
import { CURRENT_VAULT_COOKIE } from "./vault-cookie";

export type VaultSummary = {
  vault_id: string;
  slug: string;
  title: string;
  subject_name: string;
  kind: "child" | "event";
  theme: string;
  status: string;
  person_id: string;
  roles: string[];
};

export type Vault = {
  id: string;
  slug: string;
  kind: "child" | "event";
  title: string;
  subject_name: string;
  gender: string | null;
  birth_date: string | null;
  expected_birth_date: string | null;
  event_date: string | null;
  city: string | null;
  theme: string;
  welcome_message: string | null;
  upload_limits: unknown;
  nudges_enabled: boolean;
  status: "active" | "read_only" | "archived";
};

export type Viewer = {
  userId: string;
  email: string | null;
  profileId: string | null;
  displayName: string;
  /** Baú em uso agora (null se a pessoa ainda não participa de nenhum). */
  vault: Vault | null;
  vaults: VaultSummary[];
  personId: string | null;
  roles: string[];
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  canContribute: boolean;
  hasConsent: boolean;
};

/**
 * Identidade do usuário e o baú em uso. Papéis vêm do banco (RLS), nunca de
 * metadados do navegador. Serve para a NAVEGAÇÃO; a autorização real
 * continua no banco, linha a linha, pelo baú de cada registro.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: vaultRows }, { data: platform }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, status").eq("auth_user_id", auth.user.id).maybeSingle(),
    supabase.rpc("my_vaults"),
    supabase.rpc("is_platform_admin"),
  ]);
  const vaults = ((vaultRows ?? []) as VaultSummary[]).filter(() => profile?.status === "active");
  const store = await cookies();
  const wanted = store.get(CURRENT_VAULT_COOKIE)?.value;
  const current = vaults.find((v) => v.vault_id === wanted) ?? vaults[0] ?? null;

  let vault: Vault | null = null;
  let hasConsent = false;
  if (current) {
    const [{ data: v }, { data: consent }] = await Promise.all([
      supabase.from("vaults").select("*").eq("id", current.vault_id).maybeSingle(),
      supabase.rpc("has_active_consent", { p_vault: current.vault_id, p_type: "contribution_terms", p_version: POLICY_VERSION }),
    ]);
    vault = (v as Vault) ?? null;
    hasConsent = Boolean(consent);
  }
  const roles = current?.roles ?? [];
  const isAdmin = roles.includes("admin");
  return {
    userId: auth.user.id,
    email: auth.user.email ?? null,
    profileId: profile?.id ?? null,
    displayName: profile?.display_name ?? "",
    vault,
    vaults,
    personId: current?.person_id ?? null,
    roles,
    isAdmin,
    isPlatformAdmin: Boolean(platform),
    canContribute: Boolean(current) && vault?.status === "active" && (isAdmin || roles.includes("contributor")),
    hasConsent,
  };
});

/** Exige participar do baú em uso. */
export async function requireMember(opts: { needsConsent?: boolean } = {}): Promise<Viewer & { vault: Vault; personId: string }> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  if (!viewer.vault || !viewer.personId) {
    redirect(viewer.isPlatformAdmin || viewer.vaults.length === 0 ? "/baus" : "/acesso-indisponivel?motivo=sem-convite");
  }
  if (opts.needsConsent === true && !viewer.hasConsent && !viewer.isAdmin) redirect("/boas-vindas");
  return viewer as Viewer & { vault: Vault; personId: string };
}

export async function requireContributor() {
  const viewer = await requireMember();
  if (!viewer.canContribute) redirect("/inicio");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=/admin");
  if (!viewer.isAdmin || !viewer.vault || !viewer.personId) redirect("/inicio");
  return viewer as Viewer & { vault: Vault; personId: string };
}

/** Dono da plataforma (vitrine, planos, interessados). Não vê conteúdo das famílias. */
export async function requirePlatformAdmin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar?next=/plataforma");
  if (!viewer.isPlatformAdmin) redirect("/inicio");
  return viewer;
}
