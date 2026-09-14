import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "VENDEIA",
  description: "Agente de vendas com IA para WhatsApp",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
