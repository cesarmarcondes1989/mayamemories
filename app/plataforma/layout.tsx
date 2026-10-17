import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/permissions/viewer";
import { NavLinks } from "@/components/navigation/nav-links";
import { Logo } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma" };

// Painel do dono da plataforma: vitrine, planos e interessados.
// Não dá acesso ao conteúdo de nenhuma família.
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "new");
  const links = [
    { href: "/plataforma/interessados", label: "Interessados", badge: count ?? 0 },
    { href: "/plataforma/planos", label: "Planos e preços" },
    { href: "/plataforma/marca", label: "Marca e contato" },
  ];
  return (
    <div className="paper-grain min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/plataforma" className="flex items-center gap-2">
            <Logo className="size-8" />
            <span className="font-display text-2xl text-rose-deep">Plataforma</span>
          </Link>
          <div className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            <NavLinks links={links} />
          </div>
          <div className="ml-auto flex gap-3 text-sm sm:ml-0">
            <Link href="/" className="text-taupe hover:text-ink">Ver site</Link>
            <Link href="/baus" className="text-taupe hover:text-ink">Meus baús</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-20">{children}</main>
    </div>
  );
}
