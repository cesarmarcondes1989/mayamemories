import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CAPSULE_STATE_LABELS, capsuleDisplayState, type CapsuleLike } from "@/lib/permissions/capsules";
import { CAPSULE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

type Capsule = CapsuleLike & { id: string; title: string; description: string | null; capsule_type: string; theme?: string | null };

/** Cartão de cápsula */
export function CapsuleCard({ capsule, href, count }: { capsule: Capsule; href: string; count?: number }) {
  const state = capsuleDisplayState(capsule);
  const open = state === "open";
  return (
    <Link
      href={href}
      className={`group block overflow-hidden rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 ${
        open ? "border-sage/50 bg-sage-soft" : "border-line bg-paper"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span aria-hidden="true" className="text-3xl">
          {open ? "🎁" : "⧗"}
        </span>
        <Badge tone={open ? "ok" : state === "draft" ? "neutral" : "rose"}>{CAPSULE_STATE_LABELS[state]}</Badge>
      </div>
      <h3 className="text-2xl leading-snug">{capsule.title}</h3>
      {capsule.description && <p className="mt-1 line-clamp-2 text-sm text-taupe">{capsule.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-taupe">
        <span>{CAPSULE_TYPE_LABELS[capsule.capsule_type]}</span>
        {capsule.opens_at && <span>· abre em {formatDate(capsule.opens_at)}</span>}
        {typeof count === "number" && <span>· {count} {count === 1 ? "memória" : "memórias"}</span>}
      </div>
    </Link>
  );
}
