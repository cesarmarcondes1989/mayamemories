"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";
import { friendlyError } from "@/lib/errors";
import { slugBase } from "@/lib/vaults";

export type CreateVaultState = { status: "idle" | "error"; message?: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z
  .object({
    kind: z.enum(["child", "event"]),
    subjectName: z.string().trim().min(1, "Informe o nome.").max(80),
    myName: z.string().trim().min(1, "Informe como você quer ser chamado.").max(120),
    relationship: z.string().regex(/^[a-z0-9_]{2,40}$/).default("outro"),
    gender: z.enum(["girl", "boy", "unspecified"]).optional(),
    birthDate: isoDate.optional().or(z.literal("")),
    expectedBirthDate: isoDate.optional().or(z.literal("")),
    eventDate: isoDate.optional().or(z.literal("")),
    theme: z.enum(["rosa", "azul", "salvia", "marronzinho", "lavanda", "vermelho", "amarelo", "noite"]).default("rosa"),
  })
  .refine((d) => d.kind === "event" ? Boolean(d.eventDate) : Boolean(d.birthDate || d.expectedBirthDate), {
    message: "Informe a data (nascimento, data prevista ou data do evento).",
  });

export async function createVault(_prev: CreateVaultState, formData: FormData): Promise<CreateVaultState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const supabase = await createClient();
  const base = slugBase(d.subjectName);
  let vaultId: string | null = null;
  for (let i = 0; i < 6 && !vaultId; i++) {
    const slug = i === 0 ? base : `${base}-${i === 5 ? Math.random().toString(36).slice(2, 6) : i + 1}`;
    const { data, error } = await supabase.rpc("create_vault", {
      p_kind: d.kind,
      p_title: d.kind === "event" ? d.subjectName : `Baú ${d.gender === "boy" ? "do" : d.gender === "girl" ? "da" : "de"} ${d.subjectName}`,
      p_subject_name: d.subjectName,
      p_slug: slug,
      p_my_name: d.myName,
      p_relationship: d.relationship,
      p_birth_date: d.birthDate || null,
      p_expected_birth_date: d.expectedBirthDate || null,
      p_event_date: d.eventDate || null,
      p_gender: d.kind === "child" ? (d.gender ?? "unspecified") : null,
      p_theme: d.theme,
    });
    if (error && !/slug already taken|duplicate/i.test(error.message)) return { status: "error", message: friendlyError(error) };
    if (data) vaultId = data as string;
  }
  if (!vaultId) return { status: "error", message: "Não foi possível criar o baú agora. Tente novamente." };
  const store = await cookies();
  store.set(CURRENT_VAULT_COOKIE, vaultId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/admin?novo=1");
}
