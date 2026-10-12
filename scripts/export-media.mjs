#!/usr/bin/env node
// Exportação independente: manifesto + todos os arquivos de mídia.
// Gera:
//   maya-memories-export/
//   ├── manifest.json   (pessoas, visitas, memórias, comentários, cápsulas…)
//   ├── people/ visits/ memories/ capsules/   (um JSON por registro)
//   ├── media/<memory_id>/<arquivo>
//   └── README.txt
// Uso: npm run export:media -- ./maya-memories-export
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { need } from "./_env.mjs";

const out = path.resolve(process.argv[2] || `maya-memories-export-${new Date().toISOString().slice(0, 10)}`);
const url = process.env.SUPABASE_URL || need("NEXT_PUBLIC_SUPABASE_URL");
const supabase = createClient(url, need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

async function all(table, columns = "*") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const manifest = {
  format: "maya-memories-export",
  version: 1,
  exported_at: new Date().toISOString(),
  settings: (await all("app_settings", "project_title, subject_name, expected_birth_date, birth_date"))[0] ?? null,
  relationship_types: await all("relationship_types", "key, label"),
  people: await all("people", "id, display_name, relationship_type, status, created_at"),
  visits: await all("visits", "id, person_id, occurred_at, registered_at, visit_type, message, companions, status, memory_id"),
  memories: await all("memories", "id, title, description, memory_type, author_person_id, occurred_at, visibility, moderation_status, unlock_at, recipient, is_highlight, published_at, created_at, deleted_at"),
  media: (await all("media_assets", "id, memory_id, media_type, storage_path, original_filename, mime_type, size_bytes, duration_seconds, processing_status, position")).filter((m) => m.processing_status !== "deleted"),
  comments: await all("memory_comments", "id, memory_id, author_person_id, body, status, created_at"),
  capsules: await all("capsules", "id, title, description, theme, capsule_type, opens_at, opening_rule, status, visibility_policy, opened_at"),
  capsule_items: await all("capsule_items", "capsule_id, memory_id, position"),
  consents: await all("consents", "person_id, consent_type, purpose, status, policy_version, created_at"),
};

await mkdir(out, { recursive: true });
for (const [dir, rows] of [["people", manifest.people], ["visits", manifest.visits], ["memories", manifest.memories], ["capsules", manifest.capsules]]) {
  await mkdir(path.join(out, dir), { recursive: true });
  for (const row of rows) await writeFile(path.join(out, dir, `${row.id}.json`), JSON.stringify(row, null, 2));
}

let ok = 0;
let failed = 0;
for (const asset of manifest.media) {
  const target = path.join(out, "media", asset.storage_path);
  try {
    const existing = await stat(target).catch(() => null);
    if (existing && existing.size === asset.size_bytes) {
      ok++;
      continue;
    }
    const { data, error } = await supabase.storage.from("memories").download(asset.storage_path);
    if (error) throw error;
    const buf = Buffer.from(await data.arrayBuffer());
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buf);
    asset.sha256 = createHash("sha256").update(buf).digest("hex");
    ok++;
  } catch (e) {
    failed++;
    console.error(`✗ ${asset.storage_path}: ${e.message ?? e}`);
  }
}

await writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(
  path.join(out, "README.txt"),
  `Maya Memories — exportação de ${manifest.exported_at}

Este pacote não depende do banco de dados original.
- manifest.json: todos os registros e vínculos (autores, datas, cápsulas).
- media/<memory_id>/<arquivo>: arquivos originais. Cada item de "media" no manifesto
  aponta para o seu arquivo por "storage_path" e traz o sha256 para verificação.
- occurred_at = data do acontecimento; created_at = data do registro.
- Conteúdo privado: guarde este pacote com o mesmo cuidado do original.
`,
);
console.log(`✓ Exportação em ${out}: ${ok} arquivos${failed ? `, ${failed} falhas` : ""}.`);
process.exit(failed ? 2 : 0);
