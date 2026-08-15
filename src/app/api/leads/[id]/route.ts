import { NextResponse } from "next/server";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { ts } from "@/lib/utils";
import { isValidLeadStage, LEAD_STAGES } from "@/lib/leads";
import { logLeadEvent, normalizeLeadEventPayload } from "@/lib/lead-events";
import { notifyInvestorsOfOffer } from "@/lib/email/notify-offers";
import { parseStageData, negotiationAmountOf } from "@/lib/investor-portal-view";
import type { StageData } from "@/components/leads/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    if (body.stage !== undefined && !isValidLeadStage(body.stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    if (body.position !== undefined && (typeof body.position !== "number" || !Number.isInteger(body.position) || body.position < 0)) {
      return NextResponse.json({ error: "Invalid position" }, { status: 400 });
    }
    if (body.nextStepDueAt !== undefined && body.nextStepDueAt !== null && typeof body.nextStepDueAt !== "number") {
      return NextResponse.json({ error: "Invalid nextStepDueAt" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const allowed = ["stage", "priority", "notes", "assignedTo", "position", "lostReason", "nextStep", "nextStepDueAt"];
    const update: Record<string, unknown> = { updatedAt: ts() };

    const stageChanged = body.stage !== undefined && body.stage !== existing.stage;
    if (stageChanged) {
      update.stageEnteredAt = ts();
    }

    // Fáze Vyjednávání vyžaduje potvrzenou vyjednanou cenu — investor v portálu
    // smí vidět jen pevně domluvená čísla (notifikace se odesílají zde níže).
    if (body.stage === "negotiation" && stageChanged) {
      const nextStageData: StageData | null =
        (body.stageData as StageData | undefined) ?? parseStageData(existing.stageData);
      if (!negotiationAmountOf(nextStageData)) {
        return NextResponse.json(
          { error: "Pro fázi Vyjednávání je nutné zadat vyjednanou cenu v detailu leadu" },
          { status: 400 }
        );
      }
    }

    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    // Stage-specific structured data (meeting/offer/negotiation)
    if (body.stageData !== undefined) {
      if (typeof body.stageData !== "object" || body.stageData === null || Array.isArray(body.stageData)) {
        return NextResponse.json({ error: "Invalid stageData" }, { status: 400 });
      }
      const isCloud = !!process.env.DATABASE_URL;
      update.stageData = isCloud ? body.stageData : JSON.stringify(body.stageData);
    }

    await db
      .update(leads)
      .set(update)
      .where(and(eq(leads.id, id), eq(leads.userId, session.user.id)));

    // Event log (timeline v draweru)
    const stageLabel = (key: string) => LEAD_STAGES.find((s) => s.key === key)?.label ?? key;
    if (stageChanged) {
      const payload: Record<string, unknown> = { from: existing.stage, to: body.stage, fromLabel: stageLabel(existing.stage), toLabel: stageLabel(body.stage) };
      if (body.stage === "lost" && typeof body.lostReason === "string" && body.lostReason) payload.lostReason = body.lostReason;
      logLeadEvent(id, "stage_changed", payload).catch((err) => console.error("[lead-events] stage_changed selhal:", err));
    }
    if (body.notes !== undefined && typeof body.notes === "string" && body.notes !== existing.notes) {
      logLeadEvent(id, "notes", { text: body.notes }).catch((err) => console.error("[lead-events] notes selhal:", err));
    }
    if (body.nextStep !== undefined && typeof body.nextStep === "string" && body.nextStep && body.nextStep !== existing.nextStep) {
      logLeadEvent(id, "next_step", { text: body.nextStep, dueAt: body.nextStepDueAt ?? null }).catch((err) => console.error("[lead-events] next_step selhal:", err));
    }

    if (body.stageData !== undefined) {
      const prev = normalizeLeadEventPayload(existing.stageData);
      const next = body.stageData as Record<string, unknown>;
      const prevOffer = (prev.offer as { amount?: number | null } | undefined)?.amount;
      const nextOffer = (next.offer as { amount?: number | null } | undefined)?.amount;
      if (typeof nextOffer === "number" && nextOffer > 0 && nextOffer !== prevOffer) {
        logLeadEvent(id, "offer", { amount: nextOffer }).catch((err) => console.error("[lead-events] offer selhal:", err));
      }
      const prevNeg = (prev.negotiation as { currentAmount?: number | null } | undefined)?.currentAmount;
      const nextNeg = (next.negotiation as { currentAmount?: number | null } | undefined)?.currentAmount;
      if (typeof nextNeg === "number" && nextNeg > 0 && nextNeg !== prevNeg) {
        logLeadEvent(id, "negotiation", { amount: nextNeg }).catch((err) => console.error("[lead-events] negotiation selhal:", err));
      }
      const prevMeeting = (prev.meeting as { date?: string | null } | undefined)?.date;
      const nextMeeting = (next.meeting as { date?: string | null } | undefined)?.date;
      if (typeof nextMeeting === "string" && nextMeeting && nextMeeting !== prevMeeting) {
        logLeadEvent(id, "meeting", { date: nextMeeting }).catch((err) => console.error("[lead-events] meeting selhal:", err));
      }
    }

    if (body.stage === "negotiation" && stageChanged) {
      notifyInvestorsOfOffer(id).catch((err) => {
        console.error("[email] Odeslání nabídek selhalo:", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}