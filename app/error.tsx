"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-5 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl">Algo não saiu como esperado.</h1>
        <p className="mt-3 text-taupe">Nada do que você enviou foi perdido. Tente novamente em instantes.</p>
        <Button className="mt-6" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </main>
  );
}
