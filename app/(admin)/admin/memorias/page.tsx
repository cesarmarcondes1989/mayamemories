import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEMORY_SELECT, attachMediaUrls, type MemoryRow } from "@/features/memories/queries";
import { MemoryCard } from "@/components/memories/memory-card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { MODERATION_LABELS } from "@/lib/constants";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Memórias" };

export default async function AdminMemoriesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "approved" } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("memories").select(MEMORY_SELECT).order("created_at", { ascending: false }).limit(120);
  if (status !== "all" && status in MODERATION_LABELS) q = q.eq("moderation_status", status);
  const { data } = await q;
  const memories = await attachMediaUrls((data ?? []) as unknown as MemoryRow[], { firstOnly: true });
  const tabs = ["approved", "pending_review", "changes_requested", "hidden", "rejected", "uploading", "removed", "all"];
  return (
    <>
      <PageHeader eyebrow="Acervo" title="Memórias" description="Edite datas, títulos, visibilidade, destaques e cápsulas de cada memória." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`/admin/memorias?status=${t}`}
            className={cn("rounded-full border px-3 py-1.5 text-sm", t === status ? "border-ink bg-ink text-paper" : "border-line bg-paper text-taupe")}
          >
            {t === "all" ? "Todas" : MODERATION_LABELS[t].label}
          </Link>
        ))}
      </nav>
      {memories.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} href={`/admin/memorias/${m.id}`} showStatus showVisibility />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma memória neste filtro" />
      )}
    </>
  );
}
