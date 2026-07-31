"use client";

import { useState } from "react";
import Link from "next/link";
import AuctionReport, { type AuctionReportData } from "@/components/report/auction-report";

export const dynamic = "force-dynamic";

const STORAGE_KEY = "auction-report:v1";

interface StoredReport {
  data: AuctionReportData;
  type: "investor" | "owner";
}

function loadStoredReport(): StoredReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredReport;
    if (!parsed?.data) return null;
    return {
      data: parsed.data,
      type: parsed.type === "owner" || parsed.type === "investor" ? parsed.type : "investor",
    };
  } catch {
    return null;
  }
}

export default function AuctionReportPreviewPage() {
  const [stored] = useState<StoredReport | null>(loadStoredReport);

  if (!stored) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-sm text-gray-500">Pro vygenerování reportu nejprve analyzujte dražbu a otevřete report z kalkulačky.</p>
        <Link href="/off-market" className="inline-block mt-4 text-sm text-gray-900 font-medium underline">
          Zpět na Dražby
        </Link>
      </div>
    );
  }

  return <AuctionReport data={stored.data} initialType={stored.type} />;
}
