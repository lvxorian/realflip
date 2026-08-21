"use client";

import { useState } from "react";
import { EditableArea } from "./editable-area";
import { EditableBuildingType } from "./editable-building-type";
import { EditableCondition } from "./editable-condition";
import { EditableFloor } from "./editable-floor";
import { EditableYearBuilt } from "./editable-year-built";

interface SpecCardsProps {
  propertyId: string;
  rooms: string | null;
  floor: number | null;
  yearBuilt: number | null;
  buildingType: string | null;
  condition: string | null;
  area: number | null;
  areaLocked: boolean;
  areaFlag?: string | null;
  accessoryArea?: number | null;
}

const cardClass =
  "rounded-xl bg-card-hover border border-border/50 px-2 py-2 text-xs flex flex-col items-center justify-center gap-1 text-center";

/** Spec karty detailu nemovitosti — editace je vždy jen jedna otevřená. */
export function SpecCards({
  propertyId,
  rooms,
  floor,
  yearBuilt,
  buildingType,
  condition,
  area,
  areaLocked,
  areaFlag,
  accessoryArea,
}: SpecCardsProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const open = (field: string) => setEditingField(field);
  const close = () => setEditingField(null);
  const isEditing = (field: string) => editingField === field;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className={cardClass}>
        <span className="text-muted">dispozice</span>
        <span className="font-semibold text-foreground font-mono rounded-lg px-1.5 py-0.5 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent">
          {rooms ?? "—"}
        </span>
      </div>
      <div className={cardClass}>
        <span className="text-muted">patro</span>
        <EditableFloor
          propertyId={propertyId}
          floor={floor}
          editing={isEditing("patro")}
          onStartEdit={() => open("patro")}
          onClose={close}
        />
      </div>
      <div className={cardClass}>
        <span className="text-muted">rok</span>
        <EditableYearBuilt
          propertyId={propertyId}
          yearBuilt={yearBuilt}
          editing={isEditing("rok")}
          onStartEdit={() => open("rok")}
          onClose={close}
        />
      </div>
      <div className={cardClass}>
        <span className="text-muted">konstrukce</span>
        <EditableBuildingType
          propertyId={propertyId}
          buildingType={buildingType}
          editing={isEditing("konstrukce")}
          onStartEdit={() => open("konstrukce")}
          onClose={close}
        />
      </div>
      <div className={cardClass}>
        <span className="text-muted">stav</span>
        <EditableCondition
          propertyId={propertyId}
          condition={condition}
          editing={isEditing("stav")}
          onStartEdit={() => open("stav")}
          onClose={close}
        />
      </div>
      <div className={cardClass}>
        <span className="text-muted">velikost</span>
        <EditableArea
          propertyId={propertyId}
          area={area}
          areaLocked={areaLocked}
          areaFlag={areaFlag}
          accessoryArea={accessoryArea}
          editing={isEditing("velikost")}
          onStartEdit={() => open("velikost")}
          onClose={close}
        />
      </div>
    </div>
  );
}
