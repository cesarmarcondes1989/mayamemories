import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { POLICY_VERSION } from "@/lib/constants";
import {
  DEMO_BIRTH, DEMO_CAPSULES, DEMO_COMMENTS, DEMO_EMAILS, DEMO_MEMORIES, DEMO_PEOPLE, DEMO_VISITS, type DemoPersonKey,
} from "./data";

type Admin = ReturnType<typeof createAdminClient>;

const MIME: Record<string, { mime: string; media: "image" | "video" | "audio" }> = {
  jpg: { mime: "image/jpeg", media: "image" },
  mp3: { mime: "audio/mpeg", media: "audio" },
  mp4: { mime: "video/mp4", media: "video" },
};

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

async function ensureDemoUser(admin: Admin, email: string, name: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: name },
    app_metadata: { demo: true },
  });
  let userId = created.data.user?.id;
  if (!userId) {
    if (!/already|registered|exists/i.test(created.error?.message ?? "")) throw new Error(`demo user: ${created.error?.message}`);
    // Já existe: acha pelo e-mail (lista paginada)
    for (let page = 1; page < 50 && !userId; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!data.users.length) break;
    }
    if (!userId) throw new Error("demo user not found");
  }
  const profile = must(
    await admin.from("profiles").upsert({ auth_user_id: userId, display_name: name, is_demo: true, status: "active" }, { onConflict: "auth_user_id" }).select("id").single(),
    "demo profile",
  ) as { id: string };
  return profile.id;
}

/**
 * Monta (ou remonta) o "Baú da Alice". A demo anterior é arquivada, não apagada
 * (a auditoria é imutável). Roda com o service role, que é o único que escreve
 * num baú de demonstração.
 */
export async function seedDemo(origin: string, ownerProfileId: string): Promise<{ vaultId: string; memories: number }> {
  const admin = createAdminClient();
  const stamp = Date.now().toString(36);

  // 1. Arquiva a demo anterior
  const { data: old } = await admin.from("vaults").select("id, slug").eq("is_demo", true);
  for (const v of old ?? []) {
    await admin.from("vaults").update({ is_demo: false, status: "archived", slug: `arq-${v.id.slice(0, 8)}-${stamp}` }).eq("id", v.id);
  }

  // 2. Contas compartilhadas da demo
  const adminProfile = await ensureDemoUser(admin, DEMO_EMAILS.admin, "Ana (demo)");
  const familyProfile = await ensureDemoUser(admin, DEMO_EMAILS.family, "Visitante");

  // 3. Baú
  const account = must(await admin.from("accounts").insert({ name: "Demonstração", owner_profile_id: ownerProfileId }).select("id").single(), "account") as { id: string };
  const vault = must(
    await admin.from("vaults").insert({
      account_id: account.id, slug: `alice-demo-${stamp}`.slice(0, 40), kind: "child", title: "Baú da Alice", subject_name: "Alice",
      gender: "girl", birth_date: DEMO_BIRTH, theme: "rosa", is_demo: true, created_by: adminProfile,
      welcome_message: "Este é um baú de demonstração. Passeie à vontade: nada aqui é real e nada que você fizer será salvo.",
    }).select("id").single(),
    "vault",
  ) as { id: string };
  const V = vault.id;

  const family = must(
    await admin.from("access_groups").insert({ vault_id: V, name: "Família autorizada", description: "Família da Alice", is_default_family: true, created_by: adminProfile }).select("id").single(),
    "family group",
  ) as { id: string };

  // 4. Eventos
  const events: Record<"cha" | "aniversario", { id: string; group: string }> = {} as never;
  for (const [key, name, date, status] of [["cha", "Chá de bebê", "2026-03-21", "closed"], ["aniversario", "1 ano da Alice", "2027-05-12", "open"]] as const) {
    const id = crypto.randomUUID();
    const g = must(await admin.from("access_groups").insert({ vault_id: V, name: `evento:${id}`, description: `Convidados de ${name}`, created_by: adminProfile }).select("id").single(), "event group") as { id: string };
    must(await admin.from("vault_events").insert({ id, vault_id: V, name, event_date: date, status, access_group_id: g.id, created_by: adminProfile,
      description: key === "cha" ? "Deixe uma foto ou um recado para a Alice ♡" : "Venha comemorar o primeiro ano da Alice!" }), "event");
    events[key] = { id, group: g.id };
  }

  // 5. Pessoas, papéis e grupos
  const people: Record<DemoPersonKey, string> = {} as never;
  for (const p of DEMO_PEOPLE) {
    const id = crypto.randomUUID();
    people[p.key] = id;
    const profile = p.key === "ana" ? adminProfile : p.key === "visitante" ? familyProfile : null;
    must(await admin.from("people").insert({
      id, vault_id: V, display_name: p.name, relationship_type: p.rel, profile_id: profile,
      status: profile ? "active" : "invited", created_by: adminProfile, joined_event_id: p.guest ? events.cha.id : null,
    }), `person ${p.key}`);
    await admin.from("access_group_members").insert({ group_id: p.guest ? events.cha.group : family.id, person_id: id, added_by: adminProfile });
  }
  must(await admin.from("person_roles").insert([
    { vault_id: V, profile_id: adminProfile, role: "admin", created_by: adminProfile },
    { vault_id: V, profile_id: adminProfile, role: "contributor", created_by: adminProfile },
    { vault_id: V, profile_id: familyProfile, role: "contributor", created_by: adminProfile },
  ]), "roles");
  await admin.from("consents").insert({
    vault_id: V, person_id: people.visitante, consent_type: "contribution_terms", purpose: "Demonstração", status: "granted",
    policy_version: POLICY_VERSION, granted_at: new Date().toISOString(), recorded_by: familyProfile,
  });
  await admin.from("notification_preferences").upsert([{ profile_id: adminProfile }, { profile_id: familyProfile }], { onConflict: "profile_id" });

  // 6. Memórias e arquivos
  const memories: Record<string, string> = {};
  const fileCache = new Map<string, ArrayBuffer>();
  for (const m of DEMO_MEMORIES) {
    const id = crypto.randomUUID();
    memories[m.key] = id;
    const approved = (m.status ?? "approved") === "approved";
    const when = `${m.date}T12:00:00-03:00`;
    must(await admin.from("memories").insert({
      id, vault_id: V, memory_type: m.type, title: m.title, description: m.description ?? null,
      author_person_id: people[m.by], created_by_profile_id: adminProfile, occurred_at: m.date,
      visibility: "family", moderation_status: approved ? "approved" : "pending_review", is_highlight: m.highlight ?? false,
      unlock_at: m.unlock ? `${m.unlock}T09:00:00-03:00` : null, recipient: m.recipient ?? null,
      submitted_at: when, published_at: approved ? when : null, reviewed_by: approved ? adminProfile : null, reviewed_at: approved ? when : null,
      event_id: m.event ? events[m.event].id : null,
    }), `memory ${m.key}`);
    if (!m.file) continue;
    const ext = m.file.split(".").pop()!;
    const kind = MIME[ext];
    let buf = fileCache.get(m.file);
    if (!buf) {
      const res = await fetch(`${origin}/demo/${m.file}`);
      if (!res.ok) throw new Error(`asset ${m.file}: HTTP ${res.status}`);
      buf = await res.arrayBuffer();
      fileCache.set(m.file, buf);
    }
    const assetId = crypto.randomUUID();
    const path = `${V}/${id}/${assetId}.${ext}`;
    const up = await admin.storage.from("memories").upload(path, buf, { contentType: kind.mime, upsert: false });
    if (up.error) throw new Error(`upload ${m.file}: ${up.error.message}`);
    must(await admin.from("media_assets").insert({
      id: assetId, vault_id: V, memory_id: id, media_type: kind.media, storage_path: path, original_filename: m.file,
      mime_type: kind.mime, size_bytes: buf.byteLength, processing_status: "ready", created_by_profile_id: adminProfile,
      duration_seconds: kind.media === "audio" ? (m.file.startsWith("vo") ? 32 : 24) : kind.media === "video" ? 8 : null,
      width: kind.media === "image" ? 1080 : null, height: kind.media === "image" ? 1350 : null,
    }), `asset ${m.file}`);
  }

  // 7. Comentários, visitas, cápsulas
  for (const c of DEMO_COMMENTS) {
    await admin.from("memory_comments").insert({
      vault_id: V, memory_id: memories[c.on], author_person_id: people[c.by], created_by_profile_id: adminProfile, body: c.body,
      status: "approved", moderated_by: adminProfile, moderated_at: new Date().toISOString(),
    });
  }
  for (const v of DEMO_VISITS) {
    await admin.from("visits").insert({
      vault_id: V, person_id: people[v.by], occurred_at: v.date, visit_type: v.type, message: v.message,
      status: v.status ?? "approved", created_by: adminProfile, approved_by: v.status ? null : adminProfile,
      approved_at: v.status ? null : new Date().toISOString(),
    });
  }
  for (const c of DEMO_CAPSULES) {
    const cap = must(await admin.from("capsules").insert({
      vault_id: V, title: c.title, description: c.description, theme: c.theme, capsule_type: c.type, status: c.status,
      opening_rule: c.opens ? "date" : "manual", opens_at: c.opens ? `${c.opens}T09:00:00-03:00` : null,
      opened_at: c.status === "opened" ? new Date().toISOString() : null, visibility_policy: "family", created_by: adminProfile,
    }).select("id").single(), "capsule") as { id: string };
    await admin.from("capsule_items").insert(c.items.map((key, i) => ({ vault_id: V, capsule_id: cap.id, memory_id: memories[key], position: i, added_by: adminProfile })));
  }

  // 8. Tokens (ursinhos e mesas)
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b % 64]).join("");
  await admin.from("nfc_tokens").insert([
    { vault_id: V, public_id: token(), person_id: people.lucia, label: "Ursinho da Vó Lúcia", status: "active", activated_at: new Date().toISOString(), created_by: adminProfile },
    { vault_id: V, public_id: token(), person_id: people.beto, label: "Ursinho do Tio Beto", status: "active", activated_at: new Date().toISOString(), created_by: adminProfile },
    { vault_id: V, public_id: token(), label: "Mesa 1 — 1 ano", status: "active", event_id: events.aniversario.id, activated_at: new Date().toISOString(), created_by: adminProfile },
  ]);

  return { vaultId: V, memories: DEMO_MEMORIES.length };
}
