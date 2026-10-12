import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

/** Bearer token compartilhado com o n8n, comparado em tempo constante. */
export function isAuthorizedAutomation(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  let secret: string;
  try {
    secret = serverEnv.automationSecret();
  } catch {
    return false;
  }
  if (!token || secret.length < 32) return false;
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
