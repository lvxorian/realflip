import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Brickon - portál investorů",
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

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
