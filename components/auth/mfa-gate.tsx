"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";

type Mode = { kind: "loading" } | { kind: "verify"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string };

/**
 * Segundo fator (app autenticador: Google Authenticator, 1Password, Authy…).
 * Primeira vez: cadastra lendo o QR. Depois: só o código de 6 dígitos.
 */
export function MfaGate() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError("Não conseguimos carregar a verificação. Recarregue a página.");
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });
      // Restos de cadastros não concluídos atrapalham um novo
      for (const f of data.all.filter((f) => f.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Plataforma ${new Date().toISOString().slice(0, 10)}` });
      if (enrollError || !enrolled) return setError("Não conseguimos iniciar o cadastro. Confira se o MFA (TOTP) está ligado no Supabase.");
      setMode({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode.kind === "loading") return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mode.factorId, code: code.replace(/\D/g, "") });
    setBusy(false);
    if (verifyError) {
      setCode("");
      return setError("Código inválido ou expirado. Confira o relógio do celular e tente o código novo.");
    }
    router.replace("/plataforma");
    router.refresh();
  }

  if (mode.kind === "loading") {
    return error ? <Alert tone="error">{error}</Alert> : <p className="flex items-center gap-2 text-taupe"><Spinner /> Preparando…</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode.kind === "enroll" && (
        <div className="space-y-3 text-[15px]">
          <p>
            <strong>1.</strong> Abra seu app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…) e leia este QR:
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URI gerado pelo Supabase */}
          <img src={mode.qr} alt="QR para o app autenticador" className="mx-auto size-48 rounded-2xl bg-white p-2" />
          <p className="text-center text-xs text-taupe">
            Não consegue ler? Digite a chave: <code className="break-all select-all">{mode.secret}</code>
          </p>
          <p><strong>2.</strong> Digite o código de 6 dígitos que aparecer no app:</p>
        </div>
      )}
      {mode.kind === "verify" && <p className="text-[15px]">Digite o código de 6 dígitos do seu app autenticador.</p>}
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        required
        autoFocus
        placeholder="123 456"
        className="text-center text-2xl tracking-[0.3em]"
        aria-label="Código de 6 dígitos"
      />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <><Spinner /> Verificando…</> : mode.kind === "enroll" ? "Ativar e entrar" : "Entrar"}
      </Button>
    </form>
  );
}
