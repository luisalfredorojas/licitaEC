import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "LicitaEC — Contratos Públicos del SERCOP",
    template: "%s | LicitaEC",
  },
  description:
    "Encuentra y gana contratos públicos del SERCOP antes que tu competencia. Alertas en tiempo real, gestión de licitaciones y análisis de mercado.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
