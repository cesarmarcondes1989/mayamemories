import type { Metadata } from "next";
import Link from "next/link";
import { loadStory } from "@/features/story/load";
import { periodLabel } from "@/features/story/build";
import { sectionFor } from "@/features/story/texts";
import { FilmPlayer } from "@/components/story/film-player";

export const metadata: Metadata = { title: "Filme" };
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Filme do período, montado automaticamente a partir das memórias escolhidas. */
export default async function FilmPage({ params }: { params: Promise<{ periodo: string }> }) {
  const { periodo } = await params;
  const { story, texts, working, rationale, totalAll } = await loadStory(periodo, "film");
  const count = story.chapters.reduce((a, c) => a + c.items.length, 0);
  return (
    <div className="paper-grain min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-5xl text-rose-deep">O filme de {story.subject}</p>
            <p className="text-sm text-taupe">
              {periodLabel(periodo)} · {count} de {totalAll} memórias · montado automaticamente
              {working && " · a família de IAs ainda está escolhendo e escrevendo; atualize em 1 ou 2 minutos"}
            </p>
            {rationale && <p className="mt-1 max-w-2xl text-xs text-taupe">{rationale}</p>}
          </div>
          <div className="flex gap-3 text-sm">
            {[...story.years, "tudo"].map((y) => (
              <Link key={y} href={`/filme/${y}`} className={y === periodo ? "font-bold text-rose-deep" : "text-taupe underline underline-offset-4"}>{y}</Link>
            ))}
            <Link href={`/livro/${periodo}`} className="text-rose-deep underline underline-offset-4">📖 livro</Link>
            <Link href="/inicio" className="text-taupe underline underline-offset-4">voltar</Link>
          </div>
        </div>
        {count === 0 ? (
          <p className="rounded-3xl bg-paper p-8 text-center text-taupe">Ainda não há memórias aprovadas neste período.</p>
        ) : (
          <FilmPlayer
            subject={story.subject}
            periodLabel={periodLabel(periodo)}
            intro={texts.abertura ?? ""}
            outro={texts.fim ?? ""}
            contributors={story.contributors}
            music="/audio/trilha-caixinha.mp3"
            chapters={story.chapters.map((c) => ({
              label: c.label,
              text: texts[sectionFor(c)] ?? "",
              items: c.items.map(({ id, title, description, author, date, type, media }) => ({ id, title, description, author, date, type, media })),
            }))}
          />
        )}
      </div>
    </div>
  );
}
