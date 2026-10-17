import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildExportManifest, toCsv } from "@/features/admin/export";
import { planExport, type ExportAsset, type ExportMemory } from "@/lib/export/plan";
import { buildIndexHtml } from "@/lib/export/index-html";

export async function getExportPlan(supabase: SupabaseClient, vaultId: string) {
  const manifest = await buildExportManifest(supabase, vaultId);
  const parts = planExport(manifest.media as unknown as ExportAsset[], manifest.memories as unknown as ExportMemory[]);
  return { manifest, parts };
}

type Plan = Awaited<ReturnType<typeof getExportPlan>>;

/** Arquivos de texto que vão na parte 1: manifesto, planilhas, LEIA-ME e a página offline. */
export function documentEntries({ manifest, parts }: Plan, title: string): Array<{ name: string; input: string }> {
  const files = parts.flatMap((p) => p.files.map((f) => ({ asset_id: f.id, memory_id: f.memory_id, zip_path: f.zipPath, part: p.part })));
  const full = { ...manifest, files };
  const index = buildIndexHtml({
    title,
    exportedAt: manifest.exported_at,
    people: manifest.people as never,
    memories: manifest.memories as never,
    comments: manifest.comments as never,
    media: parts.flatMap((p) => p.files),
    parts: parts.length,
  });
  const readme = [
    `${title} — cópia completa`,
    `Exportado em ${manifest.exported_at}`,
    "",
    "COMO ABRIR",
    `1. Extraia ${parts.length > 1 ? `as ${parts.length} partes do ZIP na MESMA pasta` : "o ZIP numa pasta"}.`,
    "2. Abra o arquivo index.html no navegador: a história inteira, com fotos, vídeos e áudios, sem internet.",
    "",
    "O QUE TEM AQUI",
    "- media/ANO/fotos|videos|audios: os arquivos originais, com a data do momento no nome.",
    "- dados/*.csv: planilhas (pessoas, memórias, visitas, comentários) para abrir no Excel/Google Planilhas.",
    "- manifest.json: tudo em formato técnico, para importar em outro sistema no futuro.",
    "",
    "Guarde cópias em lugares diferentes (HD externo, nuvem pessoal). Este arquivo é da família.",
  ].join("\r\n");
  const csv = (rows: unknown[]) => "﻿" + toCsv(rows as Array<Record<string, unknown>>);
  return [
    { name: "LEIA-ME.txt", input: readme },
    { name: "index.html", input: index },
    { name: "manifest.json", input: JSON.stringify(full, null, 2) },
    { name: "dados/pessoas.csv", input: csv(manifest.people) },
    { name: "dados/memorias.csv", input: csv(manifest.memories) },
    { name: "dados/visitas.csv", input: csv(manifest.visits) },
    { name: "dados/comentarios.csv", input: csv(manifest.comments) },
    { name: "dados/capsulas.csv", input: csv(manifest.capsules) },
  ];
}
