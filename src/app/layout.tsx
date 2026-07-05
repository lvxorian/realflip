import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shared/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full bg-background text-foreground noise-overlay">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
