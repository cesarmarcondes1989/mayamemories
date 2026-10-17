import { NextResponse } from "next/server";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const COLUMNS = ["created_at", "name", "email", "phone", "kind", "plan_key", "persona", "age_range", "source", "status", "message", "notes"] as const;

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Evita fórmula no Excel (=, +, -, @) e escapa aspas
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Planilha dos interessados (para campanhas). O banco exige dono com 2 fatores. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isPlatformAdmin) return new NextResponse("Não encontrado", { status: 404 });
  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return NextResponse.redirect(new URL("/verificacao", publicEnv.siteUrl()));
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) return new NextResponse("Sem permissão", { status: 403 });
  const rows = (data ?? []).map((l: Record<string, unknown>) => [...COLUMNS.map((c) => cell(l[c])), cell(JSON.stringify(l.utm ?? {}))].join(";"));
  const csv = "﻿" + [[...COLUMNS, "utm"].join(";"), ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="interessados-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
