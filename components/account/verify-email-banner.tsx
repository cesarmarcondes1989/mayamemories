import { resendVerification } from "@/features/signup/actions";

/** Lembrete para quem criou a conta pelo site e ainda não confirmou o e-mail. */
export function VerifyEmailBanner({ email, sent }: { email: string | null; sent?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-amber/20 bg-amber-soft px-4 py-3 text-[15px] text-[#7a5b26]">
      <span aria-hidden="true">✉️</span>
      <p className="min-w-0 flex-1">
        {sent ? "Link reenviado! " : ""}Confirme seu e-mail <strong>{email}</strong> pelo link que enviamos — assim você entra de
        qualquer celular e pode aceitar convites de outros baús.
      </p>
      <form action={resendVerification}>
        <button type="submit" className="text-sm font-semibold underline underline-offset-4">Reenviar link</button>
      </form>
    </div>
  );
}
