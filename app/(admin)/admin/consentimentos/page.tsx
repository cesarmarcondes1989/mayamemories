import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { POLICY_VERSION } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Consentimentos" };

const TYPES = ["contribution_terms", "image_of_third_parties", "email_notifications"] as const;
const LABELS: Record<string, string> = {
  contribution_terms: "Termo de contribuição",
  image_of_third_parties: "Imagens de terceiros",
  email_notifications: "E-mails",
};

export default async function ConsentsPage() {
  const supabase = await createClient();
  const [{ data: people }, { data: consents }] = await Promise.all([
    supabase.from("people").select("id, display_name, profile_id").not("profile_id", "is", null).order("display_name"),
    supabase.from("consents").select("person_id, consent_type, status, policy_version, created_at").order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, { status: string; policy_version: string; created_at: string }>();
  for (const c of consents ?? []) {
    const k = `${c.person_id}:${c.consent_type}`;
    if (!latest.has(k)) latest.set(k, c);
  }
  return (
    <>
      <PageHeader
        eyebrow="LGPD"
        title="Consentimentos"
        description={`Cada consentimento tem finalidade e versão de política (atual: ${POLICY_VERSION}). Pendências aparecem em destaque.`}
      />
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-taupe">
            <tr>
              <th className="px-4 py-3 font-medium">Pessoa</th>
              {TYPES.map((t) => (
                <th key={t} className="px-4 py-3 font-medium">{LABELS[t]}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(people ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium">{p.display_name}</td>
                {TYPES.map((t) => {
                  const c = latest.get(`${p.id}:${t}`);
                  const outdated = c && c.policy_version !== POLICY_VERSION;
                  return (
                    <td key={t} className="px-4 py-3">
                      {c ? (
                        <>
                          <Badge tone={c.status === "granted" && !outdated ? "ok" : t === "contribution_terms" ? "warn" : "neutral"}>
                            {c.status === "granted" ? (outdated ? "Versão antiga" : "Concedido") : "Retirado"}
                          </Badge>
                          <p className="mt-1 text-xs text-taupe">{formatDateTime(c.created_at)}</p>
                        </>
                      ) : (
                        <Badge tone={t === "contribution_terms" ? "warn" : "neutral"}>Pendente</Badge>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
