import Link from "next/link";
import { getAllPlans, getLeads } from "@/features/plans/queries";
import { updateLead } from "@/features/plans/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/format";
import { whatsappLink } from "@/lib/plans";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Interessados" };

const PERSONA: Record<string, string> = {
  gestante: "gestante", mae_pai: "mãe/pai", avos: "avó/avô", padrinhos: "padrinhos/tios", noivos: "noivos", presente: "presente", outro: "outro",
};

const STATUS = {
  new: { label: "Novo", tone: "rose" },
  contacted: { label: "Em conversa", tone: "pending" },
  converted: { label: "Virou cliente", tone: "ok" },
  lost: { label: "Não fechou", tone: "neutral" },
} as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; erro?: string; salvo?: string }> }) {
  const sp = await searchParams;
  const status = sp.status && sp.status in STATUS ? sp.status : undefined;
  const [leads, plans] = await Promise.all([getLeads(status), getAllPlans()]);
  const planName = new Map(plans.map((p) => [p.key, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vitrine"
        title="Interessados"
        description="Quem pediu o baú pelo site. Responda pelo WhatsApp ou e-mail e marque o andamento aqui."
        actions={
          <a href="/plataforma/interessados/csv" className="inline-flex h-10 items-center rounded-full border border-rose/70 bg-paper px-4 text-sm font-semibold text-rose-deep">
            ⬇ Planilha (CSV)
          </a>
        }
      />
      {sp.erro && <Alert tone="error">{sp.erro}</Alert>}
      {sp.salvo && <Alert tone="success">Atualizado.</Alert>}
      <nav className="flex flex-wrap gap-2 text-sm">
        {[["", "Todos"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <Link
            key={k}
            href={k ? `/plataforma/interessados?status=${k}` : "/plataforma/interessados"}
            className={cn(
              "rounded-full border px-3 py-1.5",
              (status ?? "") === k ? "border-rose-deep bg-rose-deep text-white" : "border-line bg-paper text-taupe hover:text-ink",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {leads.length === 0 ? (
        <EmptyState title="Ninguém por aqui ainda">Divulgue o link do site — os pedidos aparecem aqui na hora.</EmptyState>
      ) : (
        <ul className="grid gap-4">
          {leads.map((l) => {
            const st = STATUS[l.status];
            return (
              <li key={l.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-3xl">{l.name}</h2>
                      <p className="text-sm text-taupe">
                        {formatDateTime(l.created_at)} · {l.kind === "event" ? "Evento" : "Criança"}
                        {l.plan_key && ` · plano ${planName.get(l.plan_key) ?? l.plan_key}`}
                        {l.source && l.source !== "site" && ` · veio de ${l.source}`}
                        {l.persona && ` · ${PERSONA[l.persona] ?? l.persona}`}
                        {l.age_range && ` · ${l.age_range} anos`}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {l.message && <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-[15px] whitespace-pre-line">{l.message}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    {l.phone && (
                      <a
                        href={whatsappLink(l.phone, `Oi, ${l.name.split(" ")[0]}! Aqui é do baú de memórias — vi que você se interessou.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center rounded-full bg-[#25D366] px-4 font-semibold text-white"
                      >
                        WhatsApp +{l.phone}
                      </a>
                    )}
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="inline-flex h-9 items-center rounded-full border border-rose/70 bg-paper px-4 font-semibold text-rose-deep">
                        {l.email}
                      </a>
                    )}
                  </div>
                  <form action={updateLead} className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-start">
                    <input type="hidden" name="id" value={l.id} />
                    <Select name="status" defaultValue={l.status} aria-label="Andamento">
                      {Object.entries(STATUS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                    <Textarea name="notes" defaultValue={l.notes ?? ""} placeholder="Anotações (só você vê)" className="min-h-12" aria-label="Anotações" />
                    <SubmitButton variant="secondary" pendingText="Salvando…">
                      Salvar
                    </SubmitButton>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
