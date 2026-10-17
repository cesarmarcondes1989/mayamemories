import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_VAULT_COOKIE } from "@/lib/permissions/vault-cookie";

export const dynamic = "force-dynamic";

/** Troca o baú em uso (só entre os baús da própria pessoa). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_vaults");
  const mine = ((data ?? []) as Array<{ vault_id: string; roles: string[] }>).find((v) => v.vault_id === id);
  if (!mine) return NextResponse.redirect(new URL("/baus", origin));
  const next = request.nextUrl.searchParams.get("para") === "admin" && mine.roles.includes("admin") ? "/admin" : "/inicio";
  const res = NextResponse.redirect(new URL(next, origin));
  res.cookies.set(CURRENT_VAULT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
