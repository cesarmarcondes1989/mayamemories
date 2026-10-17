import "server-only";
import { cookies } from "next/headers";
import type { Viewer } from "@/lib/permissions/viewer";
import { EMAIL_PROMPT_SKIP_COOKIE } from "@/lib/email-identity";

/** Mostra o convite de e-mail? Só para quem tem e-mail interno e não dispensou. */
export async function shouldPromptEmail(viewer: Viewer | null): Promise<boolean> {
  if (!viewer || viewer.hasRealEmail) return false;
  if (viewer.pendingEmail) return true;
  return (await cookies()).get(EMAIL_PROMPT_SKIP_COOKIE)?.value !== "1";
}
