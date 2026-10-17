import { ButtonLink } from "@/components/ui/button";

export function UnavailableMessage({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <div aria-hidden="true" className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-rose-soft text-2xl text-rose-deep">
        ♡
      </div>
      <h1 className="text-4xl">Este acesso não está disponível</h1>
      <p className="mt-3 text-taupe">
        {reason ?? "O link pode ter expirado ou sido substituído."} Se você acha que isso é um engano, fale com quem cuida do baú — essa pessoa pode enviar um novo convite.
      </p>
      <ButtonLink href="/entrar" variant="secondary" className="mt-8">
        Já tenho acesso
      </ButtonLink>
    </div>
  );
}
