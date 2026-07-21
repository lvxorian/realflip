import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/shared/providers";

export const metadata: Metadata = {
  title: "RealFlip Pro – Inteligentní investice do nemovitostí",
  description:
    "Profesionální SaaS nástroj pro realitní investory. Scraping, analýza trhu, AI hodnocení a deal management.",
  keywords: [
    "realitní investor",
    "flip",
    "nemovitosti",
    "investice",
    "scraping",
    "analýza trhu",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="cs"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground noise-overlay">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
