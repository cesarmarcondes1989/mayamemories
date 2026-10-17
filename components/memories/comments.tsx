"use client";
import { useActionState } from "react";
import { addComment, type CommentState } from "@/features/memories/actions";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/misc";

export function CommentForm({ memoryId }: { memoryId: string }) {
  const [state, action] = useActionState<CommentState, FormData>(addComment, { status: "idle" });
  if (state.status === "sent") {
    return <Alert tone="success" title="Comentário recebido ♡">Ele aparecerá aqui depois da revisão de quem cuida do baú.</Alert>;
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="memoryId" value={memoryId} />
      <label htmlFor="comment" className="sr-only">
        Seu comentário
      </label>
      <Textarea id="comment" name="body" required maxLength={4000} className="min-h-24" placeholder="Deixe um comentário carinhoso…" />
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <SubmitButton variant="secondary">Comentar</SubmitButton>
    </form>
  );
}
