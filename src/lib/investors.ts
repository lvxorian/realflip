export interface InvestorCore {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  budget: number | null;
  budgetUnlimited: number | null;
  notes: string | null;
}

/**
 * Formátování budgetu investora. `budgetUnlimited` = neomezeno (∞),
 * jinak číselný budget v Kč. Vrací null jen pro "Sám financuji" (žádný investor).
 */
export function formatInvestorBudget(budget: number | null, budgetUnlimited: number | null | undefined): string {
  if (budgetUnlimited) return "Neomezeno";
  if (budget != null && budget > 0) {
    if (budget >= 1_000_000) {
      const m = budget / 1_000_000;
      return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} mil. Kč`;
    }
    if (budget >= 1_000) {
      return `${Math.round(budget / 1_000)} tis. Kč`;
    }
    return `${budget.toLocaleString("cs-CZ")} Kč`;
  }
  return "Neuveden";
}

/** Zkontroluje, jestli budget investora pokrývá danou částku (neomezeno = vždy ano). */
export function budgetCovers(budget: number | null, budgetUnlimited: number | null | undefined, amount: number): boolean {
  if (budgetUnlimited) return true;
  if (budget == null) return false;
  return budget >= amount;
}
