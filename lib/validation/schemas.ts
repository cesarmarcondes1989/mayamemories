import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .refine((v) => {
    const y = Number(v.slice(0, 4));
    return y >= 1900 && y <= 2100;
  }, "Data fora do intervalo");

export const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido").max(254);

export const fileDescriptorSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(100),
  durationSeconds: z.number().nonnegative().max(86400).optional(),
});

export const memoryKinds = ["photo", "video", "audio", "text", "letter", "visit", "drawing"] as const;

export const createMemorySchema = z
  .object({
    kind: z.enum(memoryKinds),
    title: optionalText(200),
    description: optionalText(20000),
    occurredAt: isoDate.optional().nullable(),
    visibility: z.enum(["family", "private", "capsule", "selected"]).default("family"),
    recipient: optionalText(120),
    unlockAt: isoDate.optional().nullable(),
    requestedCapsuleId: z.string().uuid().optional().nullable(),
    eventId: z.string().uuid().optional().nullable(),
    files: z.array(fileDescriptorSchema).max(20).default([]),
    visit: z
      .object({
        occurredAt: isoDate,
        visitType: z.enum(["home", "maternity", "outing", "family_gathering", "celebration", "other"]),
        companions: optionalText(500),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (["photo", "video", "audio", "drawing"].includes(data.kind) && data.files.length === 0) {
      ctx.addIssue({ code: "custom", path: ["files"], message: "Escolha pelo menos um arquivo." });
    }
    if ((data.kind === "text" || data.kind === "letter") && !data.description && data.files.length === 0) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Escreva sua mensagem." });
    }
    if (data.kind === "letter" && !data.unlockAt && !data.requestedCapsuleId) {
      ctx.addIssue({ code: "custom", path: ["unlockAt"], message: "Escolha quando a carta poderá ser aberta." });
    }
    if (data.kind === "visit" && !data.visit) {
      ctx.addIssue({ code: "custom", path: ["visit"], message: "Informe os dados da visita." });
    }
  });

export type CreateMemoryInput = z.input<typeof createMemorySchema>;

export const commentSchema = z.object({
  memoryId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva um comentário.").max(4000),
});

export const personSchema = z.object({
  displayName: z.string().trim().min(1, "Informe o nome.").max(120),
  relationshipType: z.string().regex(/^[a-z0-9_]{2,40}$/),
  notes: optionalText(2000),
});

export const invitationSchema = z.object({
  personId: z.string().uuid(),
  email: z.union([emailSchema, z.literal("")]).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
  addToFamily: z.boolean().default(true),
});

export const capsuleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(4000),
    theme: optionalText(200),
    capsuleType: z.enum(["pregnancy", "birth", "growth", "letters", "special", "fifteen"]),
    openingRule: z.enum(["date", "manual", "date_and_manual"]),
    opensAt: isoDate.optional().nullable(),
    visibilityPolicy: z.enum(["family", "selected", "admins"]),
  })
  .refine((c) => c.openingRule === "manual" || Boolean(c.opensAt), {
    path: ["opensAt"],
    message: "Esta regra de abertura exige uma data.",
  });

/** Garante que redirecionamentos fiquem no próprio site (evita open redirect). */
export function safeNextPath(value: string | null | undefined, fallback = "/inicio"): string {
  if (!value) return fallback;
  try {
    // Aceita caminho relativo ou URL absoluta do próprio site
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") {
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      if (!site || new URL(site).origin !== url.origin) return fallback;
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
