"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ValuationReport, { type ValuationReportData } from "@/components/valuation/valuation-report";

export default function ValuationReportPage() {
  const router = useRouter();
  const [data, setData] = useState<ValuationReportData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("valuation-report");
      if (!raw) {
        router.replace("/odhad");
        return;
      }
      setData(JSON.parse(raw) as ValuationReportData);
    } catch {
      router.replace("/odhad");
    }
  }, [router]);

  function handlePrint() {
    window.print();
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-gray-500">Načítám report…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print flex flex-wrap items-center justify-center gap-3 mb-8">
        <button
          onClick={handlePrint}
          className="h-10 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Stáhnout PDF
        </button>
        <button
          onClick={handlePrint}
          className="h-10 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Vytisknout
        </button>
        <button
          onClick={() => router.push("/odhad")}
          className="h-10 px-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Zpět na Odhad
        </button>
      </div>
      <ValuationReport data={data} />
    </div>
  );
}
