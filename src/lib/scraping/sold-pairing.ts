/**
 * Párování inzerátů na realizované prodeje.
 *
 * Když inzerát zmizí z portálu (sweep potvrdí odstranění po grace periodě),
 * uložíme jeho finální cenu do vlastní historie transakcí (realized_sales).
 * Ta se pak používá jako komparace v Odhadu — vlastní dataset „prodáno".
 *
 * Tento modul obsahuje čisté (pure) funkce bez I/O kvůli testovatelnosti.
 */

export interface SaleableProperty {
  id: string;
  url: string | null;
  portalName: string | null;
  title: string | null;
  price: number;
  area: number | null;
  rooms: string | null;
  condition: string | null;
  buildingType: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Kdy inzerát zmizel (potvrzené odstranění) — proxy data prodeje. */
  removedAt: number | null;
}

export interface RealizedSaleInsert {
  id: string;
  propertyId: string;
  url: string | null;
  portalName: string | null;
  title: string | null;
  price: number;
  pricePerSqm: number | null;
  area: number | null;
  rooms: string | null;
  condition: string | null;
  buildingType: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  soldAt: number;
  createdAt: number;
}

/**
 * Převede nemovitost na záznam realizovaného prodeje.
 * Vrací null, pokud záznam nemá smysl (chybí cena nebo plocha — bez plochy
 * nelze počítat Kč/m² a prodej by zkazil statistiky komparací).
 */
export function toRealizedSale(
  property: SaleableProperty,
  now: number = Date.now()
): RealizedSaleInsert | null {
  if (!property.price || property.price <= 0) return null;
  if (!property.area || property.area <= 0) return null;
  // Kč/m² počítáme vždy z ceny/plochy (autoritativní pole) — uložené pricePerSqm
  // může být zastaralé. Pod 5 000 nebo nad 500 000 = chybná data (podíly, dražby, překlepy).
  const pricePerSqm = Math.round(property.price / property.area);
  if (pricePerSqm < 5000 || pricePerSqm > 500000) return null;

  return {
    id: property.id,
    propertyId: property.id,
    url: property.url,
    portalName: property.portalName,
    title: property.title,
    price: property.price,
    pricePerSqm,
    area: property.area,
    rooms: property.rooms,
    condition: property.condition,
    buildingType: property.buildingType,
    address: property.address,
    lat: property.lat,
    lng: property.lng,
    soldAt: property.removedAt ?? now,
    createdAt: now,
  };
}

/** Minimální počet dní, kdy se prodej ještě používá jako komparace (12 měsíců). */
export const REALIZED_SALE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
