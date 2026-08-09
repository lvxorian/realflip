import { db } from "@/db";
import { leadEvents } from "@/db/schema";
import { generateId, ts, safeJsonParse } from "@/lib/utils";

export type LeadEventType =
  | "stage_changed"
  | "notes"
  | "offer"
  | "negotiation"
  | "meeting"
  | "converted"
  | "next_step";

export interface LeadEvent {
  id: string;
  leadId: string;
  type: LeadEventType;
  payload: Record<string, unknown>;
  createdAt: number;
}

const isCloud = !!process.env.DATABASE_URL;

export async function logLeadEvent(
  leadId: string,
  type: LeadEventType,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const values = {
    id: generateId(),
    leadId,
    type,
    createdAt: ts(),
  };
  await db.insert(leadEvents).values(
    isCloud
      ? { ...values, payload: payload as never }
      : { ...values, payload: JSON.stringify(payload) as never }
  );
}

export function normalizeLeadEventPayload(raw: unknown): Record<string, unknown> {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return safeJsonParse<Record<string, unknown>>(typeof raw === "string" ? raw : null, {});
}

export function normalizeLeadEvent(row: {
  id: string;
  leadId: string;
  type: string;
  payload: unknown;
  createdAt: number | null;
}): LeadEvent {
  return {
    id: row.id,
    leadId: row.leadId,
    type: row.type as LeadEventType,
    payload: normalizeLeadEventPayload(row.payload),
    createdAt: row.createdAt != null ? Number(row.createdAt) : 0,
  };
}