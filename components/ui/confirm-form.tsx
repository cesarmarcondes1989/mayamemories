"use client";
import { useRef } from "react";
import { Button } from "./button";

/** Janela de confirmação acessível (usa <dialog> nativo). */
export function ConfirmAction({
  action,
  hidden,
  label,
  title,
  description,
  confirmLabel = "Confirmar",
  variant = "danger",
  size = "sm",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  label: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary" | "secondary";
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[min(92vw,28rem)] rounded-[var(--radius-card)] border border-line bg-paper p-0 text-ink backdrop:bg-ink/30 backdrop:backdrop-blur-sm"
      >
        <form action={action} className="p-6" onSubmit={() => ref.current?.close()}>
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <h2 className="text-2xl">{title}</h2>
          {description && <p className="mt-2 text-[15px] text-taupe">{description}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant={variant === "danger" ? "danger" : "primary"}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
