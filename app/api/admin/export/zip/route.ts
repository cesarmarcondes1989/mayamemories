import { NextResponse, type NextRequest } from "next/server";
import { downloadZip } from "client-zip";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";
import { documentEntries, getExportPlan } from "@/features/admin/export-zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Cada parte (~500 MB) precisa caber neste tempo
export const maxDuration = 300;

const SIGNED_TTL = 60 * 60 * 2;

/**
 * ZIP montado em fluxo: cada arquivo é baixado do armazenamento privado e
 * repassado na hora, sem guardar tudo na memória. O RLS do administrador
 * decide o que entra (o cliente é o do usuário, não o service role).
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin || !viewer.vault) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const vault = viewer.vault;
  const supabase = await createClient();
  const plan = await getExportPlan(supabase, vault.id);
  const n = Number(request.nextUrl.searchParams.get("parte") ?? "1");
  const part = plan.parts[n - 1];
  if (!Number.isInteger(n) || !part) return NextResponse.json({ error: "parte inexistente" }, { status: 404 });

  // URLs assinadas em lotes
  const urls = new Map<string, string>();
  const paths = part.files.map((f) => f.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await supabase.storage.from("memories").createSignedUrls(paths.slice(i, i + 100), SIGNED_TTL);
    for (const s of data ?? []) if (s.signedUrl && s.path) urls.set(s.path, s.signedUrl);
  }

  await supabase.rpc("log_admin_event", {
    p_vault: vault.id,
    p_action: "export.zip",
    p_resource_type: "export",
    p_resource_id: null,
    p_metadata: { part: n, parts: plan.parts.length, files: part.files.length, bytes: part.bytes },
  });

  async function* entries() {
    if (n === 1) {
      for (const doc of documentEntries(plan, vault.title)) yield { ...doc, lastModified: new Date() };
    }
    for (const f of part.files) {
      const url = urls.get(f.storage_path);
      const res = url ? await fetch(url).catch(() => null) : null;
      if (res?.ok && res.body) {
        yield { name: f.zipPath, input: res };
      } else {
        yield { name: `${f.zipPath}.INDISPONIVEL.txt`, input: `Não foi possível baixar este arquivo (${f.original_filename ?? f.id}). Tente exportar de novo.` };
      }
    }
  }

  const name = `${vault.slug}-${new Date().toISOString().slice(0, 10)}-parte-${n}-de-${plan.parts.length}.zip`;
  return new Response(downloadZip(entries()).body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
