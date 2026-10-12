import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-taupe" role="status" aria-label="Carregando">
      <Spinner className="size-6" />
    </div>
  );
}
