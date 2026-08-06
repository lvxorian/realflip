import { redirect } from "next/navigation";
import { getInvestorSession } from "@/lib/investor-session";

export default async function InvestorPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getInvestorSession();
  if (!session) {
    redirect("/investor/login");
  }
  return <>{children}</>;
}
