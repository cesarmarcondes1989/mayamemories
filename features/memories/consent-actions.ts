"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { POLICY_VERSION } from "@/lib/constants";

const PURPOSES: Record<string, string> = {
  contribution_terms:
    "Guardar e exibir minhas contribuições na plataforma Guardei pra você, conforme as regras de visibilidade e após revisão dos pais.",
  email_notifications: "Receber e-mails sobre minhas contribuições e cápsulas.",
  image_of_third_parties: "Declaro ter autorização das pessoas que aparecem nas fotos e vídeos que eu enviar.",
};

async function record(type: string, status: "granted" | "withdrawn") {
  const viewer = await getViewer();
  if (!viewer?.personId || !viewer.vault) redirect("/entrar");
  const supabase = await createClient();
  await supabase.from("consents").insert({
    vault_id: viewer.vault.id,
    person_id: viewer.personId,
    consent_type: type,
    purpose: PURPOSES[type],
    status,
    policy_version: POLICY_VERSION,
  });
}

export async function acceptTerms(formData: FormData) {
  if (formData.get("terms") !== "on") redirect("/boas-vindas?erro=1");
  await record("contribution_terms", "granted");
  if (formData.get("thirdParties") === "on") await record("image_of_third_parties", "granted");
  await record("email_notifications", formData.get("emails") === "on" ? "granted" : "withdrawn");
  redirect("/inicio");
}

export async function setConsent(formData: FormData) {
  const type = String(formData.get("type"));
  if (!(type in PURPOSES)) return;
  await record(type, formData.get("status") === "granted" ? "granted" : "withdrawn");
  revalidatePath("/perfil");
  redirect("/perfil?salvo=1");
}
