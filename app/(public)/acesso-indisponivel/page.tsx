import { UnavailableMessage } from "@/components/auth/unavailable";

const REASONS: Record<string, string> = {
  "sem-convite": "Sua conta ainda não está vinculada a um convite.",
};

export default async function UnavailablePage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams;
  const reason = motivo ? (REASONS[motivo] ?? (motivo.length < 160 ? motivo : undefined)) : undefined;
  return <UnavailableMessage reason={reason} />;
}
