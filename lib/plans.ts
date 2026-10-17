// Planos da vitrine. A fonte da verdade é a tabela public.plans; estes valores
// só aparecem se o banco ainda não tiver a migration (ou estiver fora do ar).

export type Billing = "free" | "subscription" | "one_time";
export type Audience = "child" | "event" | "any";

export type Plan = {
  key: string;
  name: string;
  tagline: string | null;
  audience: Audience;
  billing: Billing;
  price_monthly_cents: number | null;
  price_yearly_cents: number | null;
  price_once_cents: number | null;
  features: string[];
  highlight: boolean;
  sort_order: number;
  active: boolean;
};

export type Brand = {
  brand_name: string;
  brand_slogan: string;
  contact_whatsapp: string | null;
  contact_email: string | null;
};

export const DEFAULT_BRAND: Brand = {
  brand_name: "Guardei pra você",
  brand_slogan: "O baú da família para a criança abrir quando crescer.",
  contact_whatsapp: null,
  contact_email: null,
};

const plan = (p: Omit<Plan, "price_monthly_cents" | "price_yearly_cents" | "price_once_cents" | "active"> & Partial<Plan>): Plan => ({
  price_monthly_cents: null,
  price_yearly_cents: null,
  price_once_cents: null,
  active: true,
  ...p,
});

export const DEFAULT_PLANS: Plan[] = [
  plan({ key: "gratis", name: "Grátis", tagline: "Para conhecer sem compromisso", audience: "any", billing: "free", highlight: false, sort_order: 10,
    features: ["1 baú", "Até 5 convidados", "Fotos, áudios e cartas", "1 cápsula do tempo", "1 evento (ex.: chá de bebê)"] }),
  plan({ price_monthly_cents: 1990, price_yearly_cents: 19900, key: "ninho", name: "Ninho", tagline: "O essencial para guardar a história de uma criança", audience: "child", billing: "subscription", highlight: false, sort_order: 20,
    features: ["1 baú", "Até 30 convidados", "Linha do tempo e cápsulas ilimitadas", "Cartas para o futuro com bloqueio real", "Todos os temas de cor", "Até 3 eventos por ano (1 ano, chá bar, batizado…)"] }),
  plan({ price_monthly_cents: 3490, price_yearly_cents: 34900, key: "familia", name: "Família", tagline: "Para famílias grandes e mais de um filho", audience: "child", billing: "subscription", highlight: true, sort_order: 30,
    features: ["Até 3 baús (um por filho)", "Convidados ilimitados", "Vídeos mais longos", "1 ursinho NFC incluso", "Foto de capa e boas-vindas personalizadas", "Eventos ilimitados com tokens de mesa"] }),
  plan({ price_once_cents: 149000, key: "legado", name: "Legado", tagline: "A história inteira, do primeiro ultrassom aos 18 anos", audience: "child", billing: "one_time", highlight: false, sort_order: 40,
    features: ["Tudo do Família", "Filme do ano montado com as memórias", "Livro impresso anual", "2 ursinhos NFC inclusos", "Pendrive com tudo aos 15 e aos 18 anos", "O baú passa para a criança aos 18", "Eventos ilimitados com tokens de mesa"] }),
  plan({ price_once_cents: 39000, key: "evento", name: "Evento", tagline: "Casamento, chá de bebê, 15 anos", audience: "event", billing: "one_time", highlight: false, sort_order: 50,
    features: ["Convidados entram pelo QR ou NFC da mesa, sem cadastro", "Fotos, vídeos e áudios da festa num só lugar", "Filme e álbum do evento ao final", "Acesso para sempre depois da festa"] }),
];

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Preço principal + complemento. Sem preço definido → "Fale com a gente". */
export function priceLabel(p: Pick<Plan, "billing" | "price_monthly_cents" | "price_yearly_cents" | "price_once_cents">): {
  main: string;
  suffix: string;
  note: string | null;
} {
  if (p.billing === "free") return { main: "R$ 0", suffix: "para sempre", note: null };
  if (p.billing === "one_time") {
    return p.price_once_cents == null
      ? { main: "Sob consulta", suffix: "", note: "Fale com a gente" }
      : { main: formatCents(p.price_once_cents), suffix: "pagamento único", note: null };
  }
  if (p.price_monthly_cents == null && p.price_yearly_cents == null) {
    return { main: "Sob consulta", suffix: "", note: "Fale com a gente" };
  }
  if (p.price_monthly_cents == null) return { main: formatCents(p.price_yearly_cents!), suffix: "por ano", note: null };
  const yearly = p.price_yearly_cents;
  const savings = yearly != null && yearly < p.price_monthly_cents * 12 ? Math.round(100 - (yearly / (p.price_monthly_cents * 12)) * 100) : 0;
  return {
    main: formatCents(p.price_monthly_cents),
    suffix: "por mês",
    note: yearly != null ? `ou ${formatCents(yearly)}/ano${savings > 0 ? ` (economize ${savings}%)` : ""}` : null,
  };
}

/** Converte "29,90" / "29.90" / "R$ 1.299,00" em centavos. Vazio → null. */
export function parsePriceToCents(input: string): number | null {
  const raw = input.replace(/[^\d,.]/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
