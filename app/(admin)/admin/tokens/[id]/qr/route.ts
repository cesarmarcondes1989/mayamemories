import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { qrPng, qrSvg } from "@/lib/qr";

export const dynamic = "force-dynamic";

/** Download do QR de um token (PNG ou SVG). Só admin do baú do token (RLS). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer?.isAdmin || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: token } = await supabase.from("nfc_tokens").select("public_id, label, status").eq("id", id).maybeSingle();
  if (!token || ["revoked", "replaced"].includes(token.status)) return new NextResponse("Não encontrado", { status: 404 });

  const url = `${publicEnv.siteUrl()}/m/${token.public_id}`;
  const name = (token.label ?? "token").normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (request.nextUrl.searchParams.get("formato") === "svg") {
    return new NextResponse(await qrSvg(url), {
      headers: { ...headers, "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="qr-${name}.svg"` },
    });
  }
  return new NextResponse(new Uint8Array(await qrPng(url)), {
    headers: { ...headers, "Content-Type": "image/png", "Content-Disposition": `attachment; filename="qr-${name}.png"` },
  });
}
