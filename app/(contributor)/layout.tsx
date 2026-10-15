import { ContributorNav } from "@/components/navigation/contributor-nav";
import { getViewer } from "@/lib/permissions/viewer";

export const dynamic = "force-dynamic";

export default async function ContributorLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <div className="min-h-dvh">
      <ContributorNav isAdmin={Boolean(viewer?.isAdmin)} />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-32 md:pb-20">{children}</main>
    </div>
  );
}
