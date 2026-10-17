import { NextResponse, type NextRequest } from "next/server";

/**
 * Links do e-mail (token_hash). Não confirmamos no GET: antivírus e apps de
 * e-mail "pré-abrem" links e queimariam o acesso de uso único. O GET só leva
 * para /auth/abrir, onde a pessoa toca em "Entrar" (POST).
 */
export async function GET(request: NextRequest) {
  const target = new URL("/auth/abrir", request.nextUrl.origin);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target);
}
