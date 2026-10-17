import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildExportManifest, toCsv } from "@/features/admin/export";
import { getViewer } from "@/lib/permissions/viewer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const viewer = await getViewer();
  if (!viewer?.isAdmin || !viewer.vault) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const vaultId = viewer.vault.id;

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  const manifest = await buildExportManifest(supabase, vaultId);
  await supabase.rpc("log_admin_event", {
    p_vault: vaultId,
    p_action: `export.${format}`,
    p_resource_type: "export",
    p_resource_id: null,
    p_metadata: { memories: manifest.memories.length, media: manifest.media.length },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  if (format === "json") {
    return new NextResponse(JSON.stringify(manifest, null, 2), {
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${viewer.vault.slug}-${stamp}.json"` },
    });
  }
  const tables: Record<string, Array<Record<string, unknown>>> = {
    people: manifest.people as Array<Record<string, unknown>>,
    visits: manifest.visits as Array<Record<string, unknown>>,
    memories: manifest.memories as Array<Record<string, unknown>>,
    comments: manifest.comments as Array<Record<string, unknown>>,
    capsule_items: manifest.capsule_items as Array<Record<string, unknown>>,
  };
  const rows = tables[format];
  if (!rows) return NextResponse.json({ error: "unknown format" }, { status: 400 });
  return new NextResponse(toCsv(rows), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${viewer.vault.slug}-${format}-${stamp}.csv"` },
  });
}
