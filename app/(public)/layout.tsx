import Link from "next/link";
import { Logo } from "@/components/ui/misc";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-grain flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="size-9" />
          <span className="font-display text-2xl text-ink">Maya Memories</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-5 pb-8 text-sm text-taupe">
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-5">
          <span>Um espaço privado de família.</span>
          <Link href="/privacidade" className="underline-offset-4 hover:underline">
            Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
