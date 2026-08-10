// Sdílené slučování nemovitostí napříč portály pro API cesty (create-from-url,
// save-deal, calculator/save): stejná nemovitost z jiného portálu se nepřidává
// jako nový řádek, ale spojí se s kanonickým záznamem přes alt_portals.

import { eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { properties, activityLog } from "@/db/schema";
import { generateId, ts, safeJsonParse } from "@/lib/utils";
import {
  matchStrengthCrossPortal,
  isAutoMergeMatch,
  parseAltPortals,
  appendAltPortal,
  hasAltUrl,
  toDbAltPortals,
} from "@/lib/scraping/property-match";
import { PROPERTY_STATUS } from "@/lib/scraping/relisting";

export interface MergeInput {
  portalName?: string | null;
  url: string;
  title: string;
  price?: number | null;
  address?: string | null;
  rooms?: string | null;
  area?: number | null;
  description?: string | null;
  imageUrls?: string[];
  contactPhone?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
}

type PropertyRow = typeof properties.$inferSelect;

const WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

/** Najde kanonický záznam stejné nemovitosti z jiného portálu (nebo null). */
export async function findCrossPortalTarget(
  input: MergeInput
): Promise<PropertyRow | null> {
  const cutoff = Date.now() - WINDOW_MS;
  const rows = await db
    .select()
    .from(properties)
    .where(gt(properties.lastSeen, cutoff))
    .limit(2000);

  let best: PropertyRow | null = null;
  for (const row of rows) {
    if (row.url === input.url) continue;
    if (hasAltUrl(row.altPortals, input.url)) continue;
    const match = matchStrengthCrossPortal(
      {
        portalName: input.portalName ?? "manual",
        title: input.title,
        address: input.address ?? null,
        rooms: input.rooms ?? null,
        area: input.area ?? null,
        price: input.price ?? null,
      },
      {
        id: row.id,
        portalName: row.portalName,
        title: row.title,
        address: row.address,
        rooms: row.rooms,
        area: row.area,
        price: row.price,
        lastSeen: row.lastSeen,
        isActive: row.isActive,
      }
    );
    if (!isAutoMergeMatch(match)) continue;
    if (!best) {
      best = row;
      continue;
    }
    const aScore = (best.isActive === 1 ? 1 : 0) * 1e9 + (best.lastSeen ?? 0);
    const bScore = (row.isActive === 1 ? 1 : 0) * 1e9 + (row.lastSeen ?? 0);
    if (bScore > aScore) best = row;
  }
  return best;
}

/**
 * Sloučí vstup do kanonického záznamu: přidá sekundární URL do alt_portals,
 * oživí řádek, doplní jen chybějící údaje (cena/plocha zůstávají kanonické).
 * Vrací id kanonického záznamu.
 */
export async function mergeCrossPortal(
  target: PropertyRow,
  input: MergeInput
): Promise<string> {
  const nextAlt = appendAltPortal(
    parseAltPortals(target.altPortals),
    input.portalName ?? "manual",
    input.url
  );

  const oldImgs = target.imageUrls ? safeJsonParse<string[]>(target.imageUrls, []) : [];
  const newImgs = input.imageUrls ?? [];
  const imgs = newImgs.length > oldImgs.length ? newImgs : oldImgs;

  await db
    .update(properties)
    .set({
      altPortals: toDbAltPortals(nextAlt),
      isActive: 1,
      status: PROPERTY_STATUS.ACTIVE,
      removedAt: null,
      lastSeen: ts(),
      rooms: target.rooms ?? input.rooms ?? null,
      floor: target.floor ?? null,
      condition: target.condition ?? null,
      buildingType: target.buildingType ?? null,
      yearBuilt: target.yearBuilt ?? null,
      address: target.address ?? input.address ?? null,
      lat: target.lat ?? null,
      lng: target.lng ?? null,
      contactPhone: target.contactPhone ?? input.contactPhone ?? null,
      contactName: target.contactName ?? input.contactName ?? null,
      contactEmail: target.contactEmail ?? input.contactEmail ?? null,
      description: target.description ?? input.description ?? null,
      imageUrls: JSON.stringify(imgs),
    })
    .where(eq(properties.id, target.id));

  await db.insert(activityLog).values({
    id: generateId(),
    type: "scraping",
    message: `Inzerat sloucen z dalsiho portalu - ${input.title}`,
    propertyId: target.id,
    createdAt: ts(),
  });

  return target.id;
}