import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { Card } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { BarList, ColumnChart, Funnel, Kpi, fmt } from "@/components/platform/charts";
import { UtmBuilder } from "@/components/platform/utm-builder";
import { cn } from "@/components/ui/cn";

export const metadata = { title: "Analytics" };

type Row = { label: string; n: number; leads?: number };
type Analytics = {
  totals: { page_views: number; sessions: number; visitors: number; consented_share: number | null; leads: number; leads_prev: number; sessions_prev: number };
  daily: Array<{ day: string; sessions: number; leads: number }>;
  funnel: Array<{ step: string; sessions: number }>;
  hours: Array<{ hour: number; n: number }>;
  plans: Row[]; sources: Row[]; campaigns: Row[]; devices: Row[]; browsers: Row[]; os: Row[];
  regions: Row[]; cities: Row[]; pages: Row[]; personas: Row[]; ages: Row[];
  business: { vaults: number; vaults_new: number; event_vaults: number; people: number; memories_new: number };
};

const PERIODS = [7, 30, 90, 365];
const DEVICE = { mobile: "Celular", tablet: "Tablet", desktop: "Computador" } as Record<string, string>;
const PERSONA = {
  gestante: "Gestante", mae_pai: "Mãe ou pai", avos: "Avós", padrinhos: "Padrinhos/tios",
  noivos: "Noivos", presente: "Presente", outro: "Outro",
} as Record<string, string>;

const pctChange = (now: number, before: number) => (before ? ((now - before) / before) * 100 : null);
const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <h2 className="mb-3 text-2xl">{title}</h2>
      {children}
    </Card>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_analytics", { p_days: days });
  const a = data as Analytics | null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vitrine"
        title="Analytics"
        description="Quem chega ao site, de onde vem e até onde vai no caminho para virar cliente. Só o site público — nada de dentro dos baús das famílias."
        actions={
          <nav className="flex gap-1 rounded-full border border-line bg-paper p-1 text-sm" aria-label="Período">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/plataforma/analytics?dias=${p}`}
                aria-current={p === days ? "true" : undefined}
                className={cn("rounded-full px-3 py-1.5", p === days ? "bg-rose-deep text-white" : "text-taupe hover:text-ink")}
              >
                {p === 365 ? "1 ano" : `${p} dias`}
              </Link>
            ))}
          </nav>
        }
      />
      {(error || !a) && <Alert tone="warn">O analytics ainda não está ativo no banco. Aplique a migration 012 no Supabase.</Alert>}

      {a && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Visitas" value={fmt(a.totals.sessions)} delta={pctChange(a.totals.sessions, a.totals.sessions_prev)} hint={`${fmt(a.totals.page_views)} páginas vistas`} />
            <Kpi
              label="Pessoas únicas"
              value={fmt(a.totals.visitors)}
              hint={`só quem aceitou cookies (${a.totals.consented_share ?? 0}% das visitas)`}
            />
            <Kpi label="Interessados" value={fmt(a.totals.leads)} delta={pctChange(a.totals.leads, a.totals.leads_prev)} />
            <Kpi
              label="Conversão"
              value={a.totals.sessions ? `${((a.totals.leads / a.totals.sessions) * 100).toFixed(1).replace(".", ",")}%` : "—"}
              hint="interessados ÷ visitas"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Visitas por dia">
              <ColumnChart
                label="Visitas por dia"
                every={Math.ceil(a.daily.length / 8)}
                data={a.daily.map((d) => ({ label: shortDay(d.day), value: d.sessions, tip: `${shortDay(d.day)}: ${fmt(d.sessions)} visitas` }))}
              />
            </Panel>
            <Panel title="Interessados por dia">
              <ColumnChart
                label="Interessados por dia"
                every={Math.ceil(a.daily.length / 8)}
                data={a.daily.map((d) => ({ label: shortDay(d.day), value: d.leads, tip: `${shortDay(d.day)}: ${fmt(d.leads)} interessados` }))}
              />
            </Panel>
          </div>

          <Panel title="Funil: da visita ao “quero o meu”">
            <Funnel steps={a.funnel} />
            <p className="mt-3 text-xs text-taupe">
              Etapas contadas por visita. Sem cookies aceitos, cada passo conta separado — o funil fica mais preciso conforme mais pessoas aceitam.
            </p>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="De onde vêm">
              <BarList rows={a.sources} />
            </Panel>
            <Panel title="Campanhas">
              <BarList
                rows={a.campaigns.map((c) => ({ label: c.label, n: c.n, extra: fmt(c.leads ?? 0) }))}
                extra="interess."
                empty="Nenhuma campanha ainda — use o gerador de links abaixo."
              />
            </Panel>
            <Panel title="Planos mais escolhidos">
              <BarList rows={a.plans} empty="Ninguém clicou num plano ainda." />
            </Panel>
            <Panel title="Horário das visitas">
              <ColumnChart
                label="Visitas por hora do dia"
                height={120}
                every={3}
                data={a.hours.map((h) => ({ label: `${h.hour}h`, value: h.n, tip: `${h.hour}h–${h.hour + 1}h: ${fmt(h.n)} visitas` }))}
              />
              <p className="mt-2 text-xs text-taupe">Horário de Brasília. Bom para escolher a hora de postar.</p>
            </Panel>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Aparelho">
              <BarList rows={a.devices.map((d) => ({ ...d, label: DEVICE[d.label] ?? d.label }))} />
            </Panel>
            <Panel title="Navegador">
              <BarList rows={a.browsers} />
            </Panel>
            <Panel title="Sistema">
              <BarList rows={a.os} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Estados">
              <BarList rows={a.regions} empty="A região aparece quando o site roda na Vercel." />
            </Panel>
            <Panel title="Cidades">
              <BarList rows={a.cities} empty="A cidade aparece quando o site roda na Vercel." />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Quem são os interessados">
              <BarList rows={a.personas.map((p) => ({ ...p, label: PERSONA[p.label] ?? p.label }))} empty="Sem interessados no período." />
            </Panel>
            <Panel title="Idade">
              <BarList rows={a.ages} empty="Sem interessados no período." />
              <p className="mt-2 text-xs text-taupe">Idade só existe para quem preencheu o formulário — de visitante anônimo não dá para saber (e nem devemos).</p>
            </Panel>
            <Panel title="Páginas mais vistas">
              <BarList rows={a.pages} />
            </Panel>
          </div>

          <Panel title="O negócio">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Kpi label="Baús ativos" value={fmt(a.business.vaults)} />
              <Kpi label="Baús novos" value={fmt(a.business.vaults_new)} hint="no período" />
              <Kpi label="Baús de evento" value={fmt(a.business.event_vaults)} />
              <Kpi label="Pessoas ativas" value={fmt(a.business.people)} />
              <Kpi label="Memórias novas" value={fmt(a.business.memories_new)} hint="no período (só contagem)" />
            </div>
          </Panel>
        </>
      )}

      <Panel title="Gerador de links de campanha">
        <p className="mb-4 text-sm text-taupe">
          Use um link diferente em cada post, anúncio ou parceria. Aí o painel mostra exatamente qual trouxe visitas e interessados.
        </p>
        <UtmBuilder siteUrl={publicEnv.siteUrl()} />
      </Panel>
    </div>
  );
}
