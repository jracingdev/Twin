import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import { RouteGuard } from "@/components/RouteGuard";

export const metadata: Metadata = {
  title: "TWIN — Gêmeo Digital",
  description: "Plataforma de clone comportamental comunicativo",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <Providers>
          <Nav />
          <RouteGuard>
            <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
          </RouteGuard>
        </Providers>
      </body>
    </html>
  );
}
