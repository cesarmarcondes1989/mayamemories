import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/permissions/viewer";
import { getMemory, listComments } from "@/features/memories/queries";
import { MediaView } from "@/components/memories/media-view";
import { CommentForm } from "@/components/memories/comments";
import { Avatar, DateTag } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Memória" };

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const memory = await getMemory(id);
  // RLS decide: se não pode ver, a memória simplesmente não existe aqui.
  if (!memory) notFound();
  const comments = memory.moderation_status === "approved" ? await listComments(id) : [];
  const isLetter = memory.memory_type === "letter";

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Badge tone={isLetter ? "rose" : "neutral"}>{MEMORY_TYPE_LABELS[memory.memory_type]}</Badge>
        {memory.is_highlight && <Badge tone="rose">★ Destaque</Badge>}
      </div>
      {memory.title && <h1 className="text-5xl leading-tight">{memory.title}</h1>}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-taupe">
        {memory.author && (
          <span className="flex items-center gap-2">
            <Avatar name={memory.author.display_name} /> {memory.author.display_name}
          </span>
        )}
        <DateTag date={memory.occurred_at} label="Aconteceu em" />
        <span className="text-sm">Registrada em {formatDate(memory.created_at)}</span>
      </div>

      <div className="mt-8 space-y-4">
        {memory.media_assets.map((a) => (
          <MediaView key={a.id} asset={a} />
        ))}
      </div>

      {memory.description && (
        <div className={`mt-8 ${isLetter ? "rounded-[var(--radius-card)] border border-line bg-paper p-6 sm:p-10" : ""}`}>
          {isLetter && memory.recipient && <p className="letter-body mb-4 text-taupe">Para {memory.recipient},</p>}
          <p className={isLetter ? "letter-body" : "text-lg leading-relaxed whitespace-pre-wrap"}>{memory.description}</p>
        </div>
      )}

      {memory.moderation_status === "approved" && (
        <section className="mt-12 border-t border-line pt-8" aria-labelledby="comments-title">
          <h2 id="comments-title" className="mb-4 text-3xl">
            Comentários
          </h2>
          {comments.length === 0 && <p className="mb-4 text-taupe">Ainda não há comentários.</p>}
          <ul className="mb-6 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-2xl border border-line bg-paper p-4">
                <div className="mb-1 flex items-center justify-between text-sm text-taupe">
                  <span>{c.author?.display_name}</span>
                  <span>{c.status === "pending_review" ? "Aguardando revisão" : formatDate(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            ))}
          </ul>
          {viewer.canContribute && <CommentForm memoryId={memory.id} />}
        </section>
      )}
    </article>
  );
}
