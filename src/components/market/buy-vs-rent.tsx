"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/utils";
import { Scales } from "@phosphor-icons/react";

interface Result {
  mortgagePayment: number;
  totalMortgagePaid: number;
  rentTotal30y: number;
  investmentValue30y: number;
  buyNetWorth30y: number;
  rentNetWorth30y: number;
  buyWins: boolean;
}

function compute(input: {
  rentMonthly: number;
  price: number;
  interestRate: number;
  ltv: number;
  inflation: number;
  years: number;
  investReturn: number;
}): Result {
  const { rentMonthly, price, interestRate, ltv, inflation, years, investReturn } = input;
  const loan = price * (ltv / 100);
  const downPayment = price - loan;
  const months = years * 12;
  const monthlyRate = interestRate / 100 / 12;

  // Annuity mortgage payment
  const mortgagePayment =
    monthlyRate > 0
      ? (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
      : loan / months;

  const totalMortgagePaid = mortgagePayment * months;

  // Rent: annual growth with inflation, discounted by opportunity cost of investing the down payment + delta
  let rentTotal30y = 0;
  let investBalance = downPayment;
  const monthlyInvestRate = investReturn / 100 / 12;
  for (let m = 0; m < months; m++) {
    const yearIdx = Math.floor(m / 12);
    const rentNow = rentMonthly * Math.pow(1 + inflation / 100, yearIdx);
    rentTotal30y += rentNow;
    // Invest down payment + (what you save vs mortgage) — simplified: invest the down payment,
    // and assume rent is fully consumed (no delta saved).
    investBalance = investBalance * (1 + monthlyInvestRate);
  }

  const buyNetWorth30y = price; // simplified: own the asset (ignore appreciation)
  const rentNetWorth30y = investBalance - rentTotal30y;

  return {
    mortgagePayment,
    totalMortgagePaid,
    rentTotal30y,
    investmentValue30y: investBalance,
    buyNetWorth30y,
    rentNetWorth30y,
    buyWins: buyNetWorth30y > rentNetWorth30y,
  };
}

export function BuyVsRentCalculator() {
  const [form, setForm] = useState({
    rentMonthly: 20000,
    price: 5000000,
    interestRate: 5,
    ltv: 80,
    inflation: 3,
    years: 30,
    investReturn: 5,
  });
  const [result, setResult] = useState<Result | null>(null);

  const set = (k: keyof typeof form) => (v: string) => {
    const num = parseFloat(v) || 0;
    setForm((prev) => ({ ...prev, [k]: num }));
  };

  function calc() {
    setResult(compute(form));
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Scales size={16} className="text-accent" weight="duotone" />
        <span className="font-medium">Koupě vs. nájem</span>
        <span className="text-xs text-muted ml-auto">30letá simulace</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Input label="Nájem (Kč/měs)" type="number" value={form.rentMonthly.toString()} onChange={(e) => set("rentMonthly")(e.target.value)} />
        <Input label="Cena nemovitosti (Kč)" type="number" value={form.price.toString()} onChange={(e) => set("price")(e.target.value)} />
        <Input label="Úrok hypotéky (%)" type="number" value={form.interestRate.toString()} onChange={(e) => set("interestRate")(e.target.value)} />
        <Input label="LTV — % půjčky" type="number" value={form.ltv.toString()} onChange={(e) => set("ltv")(e.target.value)} />
        <Input label="Inflace nájmu (%)" type="number" value={form.inflation.toString()} onChange={(e) => set("inflation")(e.target.value)} />
        <Input label="Doba splácení (let)" type="number" value={form.years.toString()} onChange={(e) => set("years")(e.target.value)} />
        <Input label="Výnos investic (%)" type="number" value={form.investReturn.toString()} onChange={(e) => set("investReturn")(e.target.value)} />
      </div>

      <Button onClick={calc} className="mt-4 w-full">
        Spočítat
      </Button>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl bg-card-hover border border-border/50 p-4">
            <p className="text-xs text-muted">Měsíční splátka hypotéky</p>
            <p className="text-lg font-semibold font-mono">{formatPrice(Math.round(result.mortgagePayment))} Kč</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-card-hover/60 border border-border/50 p-3">
              <p className="text-xs text-muted">Nájem celkem za {form.years} let</p>
              <p className="font-mono font-semibold">{formatPrice(Math.round(result.rentTotal30y))}</p>
            </div>
            <div className="rounded-xl bg-card-hover/60 border border-border/50 p-3">
              <p className="text-xs text-muted">Investice (akontace + výnos)</p>
              <p className="font-mono font-semibold">{formatPrice(Math.round(result.investmentValue30y))}</p>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${result.buyWins ? "bg-emerald-500/5 border-emerald-500/25" : "bg-amber-500/5 border-amber-500/25"}`}>
            <p className="text-xs text-muted mb-1">
              {result.buyWins ? "Výhodnější je koupit" : "Výhodnější je pronajímat a investovat"}
            </p>
            <p className="text-sm font-medium">
              Koupě: <span className="font-mono">{formatPrice(Math.round(result.buyNetWorth30y))} Kč</span>
              {" · "}Pronájem: <span className="font-mono">{formatPrice(Math.round(result.rentNetWorth30y))} Kč</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
