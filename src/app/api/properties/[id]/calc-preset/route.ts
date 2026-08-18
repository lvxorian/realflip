import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { calculatorPresets, propertyAnalysis } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId, ts } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;

    const preset = await db
      .select()
      .from(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ))
      .limit(1)
      .then((r) => r[0]);

    if (!preset) {
      return NextResponse.json({ preset: null });
    }

    return NextResponse.json({
      preset: {
        arv: preset.arv,
        renovationCost: preset.renovationCost,
        targetRoi: preset.targetRoi,
        mode: preset.mode ?? "flip",
        config: preset.config ? JSON.parse(preset.config) : {},
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;
    const body = await req.json();
    const now = ts();

    const existing = await db
      .select({ id: calculatorPresets.id })
      .from(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      await db
        .update(calculatorPresets)
        .set({
          arv: body.arv ?? null,
          renovationCost: body.renovationCost ?? null,
          targetRoi: body.targetRoi ?? 15,
          mode: body.mode === "rental" ? "rental" : "flip",
          config: JSON.stringify({ ...(body.costConfig || {}), flipStrategy: body.flipStrategy ?? "both", rental: body.rental ?? null, renovationMode: body.renovationMode ?? null, renovationLevel: body.renovationLevel ?? null, renovationPerSqm: body.renovationPerSqm ?? null, renovationItems: body.renovationItems ?? null, manualFlipPrice: typeof body.manualFlipPrice === "number" ? body.manualFlipPrice : null }),
          updatedAt: now,
        })
        .where(eq(calculatorPresets.id, existing.id));
    } else {
      await db.insert(calculatorPresets).values({
        id: generateId(),
        propertyId,
        userId: session.user.id,
        arv: body.arv ?? null,
        renovationCost: body.renovationCost ?? null,
        targetRoi: body.targetRoi ?? 15,
        mode: body.mode === "rental" ? "rental" : "flip",
        config: JSON.stringify({ ...(body.costConfig || {}), flipStrategy: body.flipStrategy ?? "both", rental: body.rental ?? null, renovationMode: body.renovationMode ?? null, renovationLevel: body.renovationLevel ?? null, renovationPerSqm: body.renovationPerSqm ?? null, renovationItems: body.renovationItems ?? null, manualFlipPrice: typeof body.manualFlipPrice === "number" ? body.manualFlipPrice : null }),
        createdAt: now,
        updatedAt: now,
      });
    }

// Propsat mód a čistý výnos do property_analysis, aby ho viděli
    // konzumenti DB (portál, report, call-mode, dashboard). calc_mode slouží
    // portálu k rozlišení výnosové rekau se mají zobrazit.
    if (body.mode === "rental") {
      const monthlyRent =
        typeof body.rental?.monthlyRent === "number" && body.rental.monthlyRent > 0
          ? Math.round(body.rental.monthlyRent)
          : null;
      const snapshot = {
        mode: "rental",
        purchasePriceUsed: typeof body.purchasePriceUsed === "number" ? Math.round(body.purchasePriceUsed) : null,
        monthlyRent,
        netYield: typeof body.rentalNetYield === "number" ? body.rentalNetYield : null,
        grossYield: typeof body.rentalGrossYield === "number" ? body.rentalGrossYield : null,
        netYieldAfterTax: typeof body.rentalNetYieldAfterTax === "number" ? body.rentalNetYieldAfterTax : null,
        capRate: typeof body.rentalCapRate === "number" ? body.rentalCapRate : null,
        cashFlowMonthly: typeof body.rentalCashFlowMonthly === "number" ? Math.round(body.rentalCashFlowMonthly) : null,
        totalInvested: typeof body.rentalTotalInvested === "number" ? Math.round(body.rentalTotalInvested) : null,
        targetPurchasePrice: typeof body.rentalTargetPurchasePrice === "number" ? Math.round(body.rentalTargetPurchasePrice) : null,
        legalFee: typeof body.rentalLegalFee === "number" ? Math.round(body.rentalLegalFee) : null,
        appraisalFee: typeof body.rentalAppraisalFee === "number" ? Math.round(body.rentalAppraisalFee) : null,
        sourcingFee: typeof body.rentalSourcingFee === "number" ? Math.round(body.rentalSourcingFee) : null,
        renovationCost: typeof body.rentalRenovationCost === "number" ? Math.round(body.rentalRenovationCost) : null,
        hasMortgage: typeof body.rentalHasMortgage === "boolean" ? body.rentalHasMortgage : null,
        mortgageAmount: typeof body.rentalMortgageAmount === "number" ? Math.round(body.rentalMortgageAmount) : null,
        ltv: typeof body.rentalLtv === "number" ? Math.round(body.rentalLtv) : null,
        noiAnnual: typeof body.rentalNoiAnnual === "number" ? Math.round(body.rentalNoiAnnual) : null,
        cashOnCash: typeof body.rentalCashOnCash === "number" ? body.rentalCashOnCash : null,
      };
      await db
        .update(propertyAnalysis)
        .set({
          calcMode: "rental",
          monthlyRent,
          rentalYield: snapshot.netYield != null && snapshot.netYield > 0
            ? Math.round(snapshot.netYield * 10) / 10
            : null,
          cashFlowMonthly: snapshot.cashFlowMonthly,
          calcSnapshot: JSON.stringify(snapshot),
          netProfit: null,
          roi: null,
          annualizedRoi: null,
          cashOnCash: null,
          totalCost: null,
          updatedAt: now,
        })
        .where(eq(propertyAnalysis.propertyId, propertyId));
    } else {
      const netProfit =
        typeof body.flipNetProfit === "number" ? Math.round(body.flipNetProfit) : null;
      const roi =
        typeof body.flipRoi === "number" ? Math.round(body.flipRoi * 10) / 10 : null;
      const annualizedRoi =
        typeof body.flipAnnualizedRoi === "number" ? Math.round(body.flipAnnualizedRoi * 10) / 10 : null;
      const snapshot = {
        mode: "flip",
        purchasePriceUsed: typeof body.purchasePriceUsed === "number" ? Math.round(body.purchasePriceUsed) : null,
        arv: typeof body.arv === "number" ? Math.round(body.arv) : null,
        renovationCost: typeof body.renovationCost === "number" ? Math.round(body.renovationCost) : null,
        netProfit,
        roi,
        annualizedRoi,
        cashOnCash: typeof body.flipCashOnCash === "number" ? Math.round(body.flipCashOnCash * 10) / 10 : null,
        totalCost: typeof body.flipTotalCost === "number" ? Math.round(body.flipTotalCost) : null,
        targetPurchasePrice: typeof body.flipTargetPurchasePrice === "number" ? Math.round(body.flipTargetPurchasePrice) : null,
        legalFees: typeof body.flipLegalFees === "number" ? Math.round(body.flipLegalFees) : null,
        appraisalFee: typeof body.flipAppraisalFee === "number" ? Math.round(body.flipAppraisalFee) : null,
        contingency: typeof body.flipContingency === "number" ? Math.round(body.flipContingency) : null,
        holdingCosts: typeof body.flipHoldingCosts === "number" ? Math.round(body.flipHoldingCosts) : null,
        holdingMonths: typeof body.flipHoldingMonths === "number" ? Math.round(body.flipHoldingMonths) : null,
        sellingCommission: typeof body.flipSellingCommission === "number" ? Math.round(body.flipSellingCommission) : null,
        marketingPhoto: typeof body.flipMarketingPhoto === "number" ? Math.round(body.flipMarketingPhoto) : null,
        mortgageCost: typeof body.flipMortgageCost === "number" ? Math.round(body.flipMortgageCost) : null,
        sourcingFee: typeof body.flipSourcingFee === "number" ? Math.round(body.flipSourcingFee) : null,
        incomeTax: typeof body.flipIncomeTax === "number" ? Math.round(body.flipIncomeTax) : null,
        cooperation: {
          availability:
            body.flipStrategy === "fifty-fifty" || body.flipStrategy === "sourcing-fee" ? body.flipStrategy : "both",
          netProfitTotal: typeof body.flipProfitTotal === "number" ? Math.round(body.flipProfitTotal) : null,
          investorProfitFiftyFifty: typeof body.flipProfitFiftyFifty === "number" ? Math.round(body.flipProfitFiftyFifty) : null,
          investorProfitSourcing: typeof body.flipProfitSourcing === "number" ? Math.round(body.flipProfitSourcing) : null,
          sourcingFee: typeof body.flipSourcingFee === "number" ? Math.round(body.flipSourcingFee) : null,
        },
      };
      await db
        .update(propertyAnalysis)
        .set({
          calcMode: "flip",
          arv: snapshot.arv,
          renovationCost: snapshot.renovationCost,
          netProfit,
          roi,
          annualizedRoi,
          cashOnCash: snapshot.cashOnCash,
          totalCost: snapshot.totalCost,
          calcSnapshot: JSON.stringify(snapshot),
          monthlyRent: null,
          rentalYield: null,
          cashFlowMonthly: null,
          updatedAt: now,
        })
        .where(eq(propertyAnalysis.propertyId, propertyId));
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: propertyId } = await params;

    await db
      .delete(calculatorPresets)
      .where(and(
        eq(calculatorPresets.propertyId, propertyId),
        eq(calculatorPresets.userId, session.user.id)
      ));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
