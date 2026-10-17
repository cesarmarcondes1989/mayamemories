import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyError } from "@/lib/errors";
import { slugBase } from "@/lib/vaults";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const vaultSchema = z
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
  .refine((d) => (d.kind === "event" ? Boolean(d.eventDate) : Boolean(d.birthDate || d.expectedBirthDate)), {
    message: "Informe a data (nascimento, data prevista ou data do evento).",
  });

export type VaultInput = z.infer<typeof vaultSchema>;

/** Cria o baú como o usuário da sessão (o banco confere limites e permissões). */
export async function createVaultAsUser(supabase: SupabaseClient, d: VaultInput): Promise<{ id: string } | { error: string }> {
  const base = slugBase(d.subjectName);
  for (let i = 0; i < 6; i++) {
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
    if (error && !/slug already taken|duplicate/i.test(error.message)) return { error: friendlyError(error) };
    if (data) return { id: data as string };
  }
  return { error: "Não foi possível criar o baú agora. Tente novamente." };
}
