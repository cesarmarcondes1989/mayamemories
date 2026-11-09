import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { HashSessionHandler } from "@/components/auth/hash-session";
import { getViewer } from "@/lib/permissions/viewer";
import { isSupabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/demo/demo-banner";

// Títulos: letra desenhada à mão. Texto: sans arredondada. Cartas: manuscrita.
// Arquivos da Google Fonts (licença OFL) hospedados no projeto: o build não
// depende do Google responder (ele às vezes devolve endereços que o Next não lê).
const display = localFont({
  src: [
    { path: "./fonts/amatic-400-latin.woff2", weight: "400" },
    { path: "./fonts/amatic-700-latin.woff2", weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
});
const body = localFont({ src: "./fonts/nunito-200-1000-latin.woff2", weight: "200 1000", variable: "--font-body", display: "swap" });
const hand = localFont({ src: "./fonts/caveat-400-700-latin.woff2", weight: "400 700", variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Guardei pra você", template: "%s · Guardei pra você" },
  description: "Guardei pra você: o baú da família para a criança abrir quando crescer.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: "/icon.svg" },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#fdf3f4",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tema do baú em uso (rosa, azul, sálvia…). Sem baú: rosa.
  const viewer = isSupabaseConfigured() ? await getViewer().catch(() => null) : null;
  return (
    <html lang="pt-BR" data-theme={viewer?.vault?.theme ?? "rosa"} className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body className="text-ink antialiased">
        <HashSessionHandler />
        {viewer?.isDemo && <DemoBanner />}
        {children}
      </body>
    </html>
  );
}
