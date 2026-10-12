import Link from "next/link";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/navigation/nav-links";
import { Logo } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ count: pendingMemories }, { count: pendingComments }, { count: pendingDeletions }] = await Promise.all([
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("moderation_status", "pending_review").is("deleted_at", null),
    supabase.from("memory_comments").select("id", { count: "exact", head: true }).eq("status", "pending_review").is("deleted_at", null),
    supabase.from("data_deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const pending = (pendingMemories ?? 0) + (pendingComments ?? 0) + (pendingDeletions ?? 0);
  const links = [
    { href: "/admin", label: "Painel" },
    { href: "/admin/aprovacao", label: "Aprovação", badge: pending },
    { href: "/admin/memorias", label: "Memórias" },
    { href: "/admin/timeline", label: "Linha do tempo" },
    { href: "/admin/capsulas", label: "Cápsulas" },
    { href: "/admin/pessoas", label: "Pessoas" },
    { href: "/admin/convites", label: "Convites" },
    { href: "/admin/tokens", label: "Tokens NFC" },
    { href: "/admin/visitas", label: "Visitas" },
    { href: "/admin/consentimentos", label: "Consentimentos" },
    { href: "/admin/auditoria", label: "Auditoria" },
    { href: "/admin/exportacao", label: "Exportação" },
    { href: "/admin/configuracoes", label: "Configurações" },
  ];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-paper lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="size-8" />
            <span className="font-display text-2xl text-rose-deep">Administração</span>
          </Link>
          <Link href="/inicio" className="text-sm text-taupe underline-offset-4 hover:underline lg:hidden">
            Sair do painel
          </Link>
        </div>
        <div className="px-3 pb-3 lg:hidden">
          <NavLinks links={links} />
        </div>
        <div className="hidden px-3 pb-6 lg:block">
          <NavLinks links={links} vertical />
          <Link href="/inicio" className="mt-6 block px-3 text-sm text-taupe hover:text-ink">
            ← Visão do contribuinte
          </Link>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-20 lg:px-10">{children}</main>
    </div>
  );
}
