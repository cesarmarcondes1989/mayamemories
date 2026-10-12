"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { Spinner } from "./spinner";

export function SubmitButton({
  children,
  pendingText = "Enviando…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
