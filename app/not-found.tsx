import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="paper-grain grid min-h-dvh place-items-center px-5 text-center">
      <div className="max-w-md">
        <p className="font-display text-7xl text-rose-deep">♡</p>
        <h1 className="mt-4 text-4xl">Esta página não existe — ou não está disponível para você.</h1>
        <p className="mt-3 text-taupe">Algumas memórias só aparecem para quem foi autorizado, e algumas só no momento certo.</p>
        <ButtonLink href="/" variant="secondary" className="mt-8">
          Voltar ao início
        </ButtonLink>
      </div>
    </main>
  );
}
