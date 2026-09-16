import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "VENDEIA",
  description: "Agente de vendas com IA para WhatsApp",
};

// Correct mobile scaling. We intentionally keep pinch-zoom enabled (no
// maximum-scale/user-scalable=no) for accessibility — the input-focus zoom is
// prevented by the 16px form-control rule in globals.css, not by locking zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
