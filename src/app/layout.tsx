import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/shared/providers";

export async function generateMetadata(): Promise<Metadata> {
  if (process.env.INVESTOR_ONLY === "1") {
    return {
      title: "Brickon – Soukromý investorský portál",
      description:
        "Soukromé off-market nabídky nemovitostí s vyjednanou slevou a kompletní analýzou zisku a návratnosti.",
      icons: {
        icon: [
          { url: "/brickon.svg", type: "image/svg+xml", sizes: "any" },
          { url: "/brickon.png", type: "image/png", sizes: "32x32" },
        ],
        shortcut: "/brickon.png",
        apple: "/brickon.png",
      },
    };
  }

  return {
    title: "RealFlip – Investiční nástroje pro realitní investory",
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
    icons: {
      icon: [
        { url: "/favicon.ico", type: "image/x-icon" },
        { url: "/favicon.ico", type: "image/png", sizes: "32x32" },
      ],
      shortcut: "/favicon.ico",
      apple: "/favicon.ico",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="cs"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("rf-theme");if(t==="light"){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");}}catch(e){document.documentElement.classList.add("dark");}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground noise-overlay">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

