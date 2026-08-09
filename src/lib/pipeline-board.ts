import { arrayMove } from "@dnd-kit/sortable";

export interface BoardLead {
  id: string;
  stage: string;
  position: number | null;
  stageEnteredAt: number | null;
  updatedAt: number | null;
}

const byPos = <T extends BoardLead>(a: T, b: T) => (a.position ?? 0) - (b.position ?? 0);

export interface MoveResult<T extends BoardLead = BoardLead> {
  leads: T[];
  newPos: number;
}

/**
 * Přesun leadu do cílové fáze (či uvnitř stejné) a vrátí nový seznam + cílový index.
 * positionOverride ≥ 0 = místo na konkrétní index (použito při vrácení zpět / undo).
 */
export function moveLeadToStage<T extends BoardLead>(
  leads: T[],
  id: string,
  toStage: string,
  overId: string | null,
  positionOverride: number | null = null
): MoveResult<T> | null {
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;

  const updatedLead: T = {
    ...lead,
    stage: toStage,
    stageEnteredAt: toStage === lead.stage ? lead.stageEnteredAt : Date.now(),
    updatedAt: Date.now(),
  };

  const rest = leads.filter((l) => l.id !== id);
  const to = rest.filter((l) => l.stage === toStage).sort(byPos);

  let insertAt = to.length;
  if (positionOverride != null && positionOverride >= 0) {
    insertAt = Math.min(positionOverride, to.length);
  } else if (overId && overId !== id) {
    const overIndex = to.findIndex((l) => l.id === overId);
    if (overIndex >= 0) insertAt = overIndex;
  }

  to.splice(insertAt, 0, { ...updatedLead, position: insertAt });

  const from = rest.filter((l) => l.stage === lead.stage);
  const others = rest.filter((l) => l.stage !== lead.stage && l.stage !== toStage);

  return { leads: [...others, ...from, ...to], newPos: insertAt };
}

/** Přerovnání uvnitř stejné fáze (drag na jinou kartu ve stejném sloupci). */
export function reorderLeadInStage<T extends BoardLead>(
  leads: T[],
  id: string,
  overId: string
): MoveResult<T> | null {
  const lead = leads.find((l) => l.id === id);
  const overLead = leads.find((l) => l.id === overId);
  if (!lead || !overLead || lead.stage !== overLead.stage) return null;

  const stageList = leads.filter((l) => l.stage === lead.stage).sort(byPos);
  const fromIndex = stageList.findIndex((l) => l.id === id);
  const toIndex = stageList.findIndex((l) => l.id === overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;

  const reordered = arrayMove(stageList, fromIndex, toIndex).map((l, i) => ({ ...l, position: i }));
  const rest = leads.filter((l) => l.stage !== lead.stage);

  return {
    leads: [...rest, ...reordered],
    newPos: reordered.findIndex((l) => l.id === id),
  };
}