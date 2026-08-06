import type { Metadata } from "next";
import RealFlipLanding from "@/components/landing/realflip-landing";
import BrickonLanding from "@/components/investor/brickon-landing";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (process.env.INVESTOR_ONLY === "1") {
    return {
      title: "Brickon – Soukromý investorský portál",
      description:
        "Soukromé off-market nabídky nemovitostí s vyjednanou cenou pod trhem a kompletní analýzou zisku a návratnosti.",
    };
  }
  return {};
}

export default function Home() {
  if (process.env.INVESTOR_ONLY === "1") {
    return <BrickonLanding />;
  }
  return <RealFlipLanding />;
}
