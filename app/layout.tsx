import type { Metadata, Viewport } from "next";
import { Amatic_SC, Caveat, Nunito } from "next/font/google";
import "./globals.css";
import { HashSessionHandler } from "@/components/auth/hash-session";

// Títulos: letra desenhada à mão. Texto: sans arredondada. Cartas: manuscrita.
const display = Amatic_SC({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-display", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-hand", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Maya Memories", template: "%s · Maya Memories" },
  description: "Um legado familiar digital, construído por pessoas importantes na vida da Maya.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: "/icon.svg" },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  themeColor: "#fdf3f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${hand.variable}`}>
      <body className="text-ink antialiased">
        <HashSessionHandler />
        {children}
      </body>
    </html>
  );
}
