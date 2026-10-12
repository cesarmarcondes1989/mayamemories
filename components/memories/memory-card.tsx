import Link from "next/link";
import type { MemoryRow } from "@/features/memories/queries";
import { MediaView } from "./media-view";
import { Avatar, DateTag } from "@/components/ui/misc";
import { Badge, PrivacyBadge, StatusBadge } from "@/components/ui/badge";
import { MEMORY_TYPE_LABELS } from "@/lib/constants";

/** Cartão de memória */
export function MemoryCard({
  memory,
  href,
  showStatus = false,
  showVisibility = false,
}: {
  memory: MemoryRow;
  href?: string;
  showStatus?: boolean;
  showVisibility?: boolean;
}) {
  const media = memory.media_assets[0];
  const extra = memory.media_assets.length - 1;
  const isLetter = memory.memory_type === "letter";
  const body = (
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-[var(--shadow-soft)] transition hover:border-rose-deep/30">
      {media && (
        <div className="relative">
          <MediaView asset={media} compact />
          {extra > 0 && <span className="absolute top-2 right-2 rounded-full bg-ink/60 px-2 py-0.5 text-xs text-paper">+{extra}</span>}
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={isLetter ? "rose" : "neutral"}>{MEMORY_TYPE_LABELS[memory.memory_type] ?? memory.memory_type}</Badge>
          {memory.is_highlight && <Badge tone="rose">★ Destaque</Badge>}
          {memory.capsule_items?.length > 0 && <Badge tone="sage">⧗ Em cápsula</Badge>}
          {showVisibility && <PrivacyBadge visibility={memory.visibility} />}
          {showStatus && <StatusBadge status={memory.moderation_status} />}
        </div>
        {memory.title && <h3 className="text-2xl leading-snug">{memory.title}</h3>}
        {memory.description && (
          <p className={`mt-1 line-clamp-4 text-[15px] text-ink/80 ${isLetter ? "letter-body text-lg" : ""}`}>{memory.description}</p>
        )}
        {memory.memory_type === "visit" && !memory.description && (
          <p className="mt-1 text-[15px] text-ink/80">Esteve com a Maya.</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          {memory.author && (
            <span className="flex min-w-0 items-center gap-2 text-sm text-taupe">
              <Avatar name={memory.author.display_name} size="sm" />
              <span className="truncate">{memory.author.display_name}</span>
            </span>
          )}
          <DateTag date={memory.occurred_at ?? memory.created_at} />
        </div>
      </div>
    </article>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
