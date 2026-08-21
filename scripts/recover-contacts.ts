/**
 * Obnova kontaktů přes CRAWLER adaptéry (stejná extrakce, kterou používal
 * původní crawl = zdroj pravdy), ne přes URL-scraper.
 *
 * Proč: chybný backfill realitymat (zřetězené .where()) přepsal kontakty
 * u všech portálů; následná obnova přes scrapeUrl použila URL-scraper,
 * který u annonce/hyperinzerce/mmreality/reality-cz extrahuje méně než
 * crawler adapter a některé legitimní hodnoty opět vymazal. Tento skript
 * používá adapter.enrichListing() (crawler selectory) a pravidlo:
 *   - neprázdná nová hodnota → uloží se,
 *   - prázdná nová hodnota → stávající neprázdná se ZACHOVÁ,
 *   - výjimka: realitymat obecný email info@realitymat.cz → null (záměr).
 *
 * Spuštění:
 *   npx tsx scripts/recover-contacts.ts            (dry-run)
 *   npx tsx scripts/recover-contacts.ts --apply    (zápis do DB)
 */

import "./_env";
import { db } from "../src/db";
import { properties } from "../src/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";
import type { RawListing } from "../src/lib/scraping/types";
import { AnnonceAdapter } from "../src/lib/scraping/adapters/annonce";
import { BazosAdapter } from "../src/lib/scraping/adapters/bazos";
import { HyperinzerceAdapter } from "../src/lib/scraping/adapters/hyperinzerce";
import { MmrealityAdapter } from "../src/lib/scraping/adapters/mmreality";
import { RealityCzAdapter } from "../src/lib/scraping/adapters/reality-cz";
import { RealityMatAdapter } from "../src/lib/scraping/adapters/realitymat";
import { IdnesRealityAdapter } from "../src/lib/scraping/adapters/idnes-reality";
import { RealityMixAdapter } from "../src/lib/scraping/adapters/realitymix";

const APPLY = process.argv.includes("--apply");

// adaptéry: portály, kde enrichListing extrahuje kontakt (crawler selectory)
const adapters: Record<string, { enrichListing(l: RawListing): Promise<RawListing> }> = {
  annonce: new AnnonceAdapter() as never,
  bazos: new BazosAdapter() as never,
  hyperinzerce: new HyperinzerceAdapter() as never,
  mmreality: new MmrealityAdapter() as never,
  "reality-cz": new RealityCzAdapter() as never,
  realitymat: new RealityMatAdapter(),
  "idnes-reality": new IdnesRealityAdapter(),
  realitymix: new RealityMixAdapter(),
};

const GENERIC_PORTAL_EMAILS = ["info@realitymat.cz"];

const isEmpty = (v: unknown) => v == null || v === "";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`=== Obnova kontaktů přes adaptéry (${APPLY ? "APLIKUJI" : "dry-run"}) ===\n`);

  const props = await db
    .select()
    .from(properties)
    .where(
      and(
        eq(properties.isActive, 1),
        or(isNull(properties.contactName), isNull(properties.contactPhone), isNull(properties.contactEmail))
      )
    );

  const targets = props.filter(
    (p) => p.url && p.url.startsWith("http") && adapters[p.portalName ?? ""]
  );

  console.log(`Kandidátů: ${props.length}, po vyřazení portálů bez kontaktu: ${targets.length}\n`);

  let ok = 0;
  let changed = 0;
  let kept = 0;
  let failed = 0;

  for (const p of targets) {
    const adapter = adapters[p.portalName ?? ""];

    const raw: RawListing = {
      portalName: (p.portalName ?? "manual") as RawListing["portalName"],
      url: p.url ?? "",
      title: p.title,
      price: p.price,
      pricePerSqm: p.pricePerSqm ?? null,
      area: p.area ?? null,
      usableArea: p.usableArea ?? null,
      floorArea: p.floorArea ?? null,
      accessoryArea: p.accessoryArea ?? null,
      rooms: p.rooms ?? null,
      floor: p.floor ?? null,
      condition: p.condition ?? null,
      buildingType: p.buildingType ?? null,
      yearBuilt: p.yearBuilt ?? null,
      address: p.address ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      contactPhone: null,
      contactName: null,
      contactEmail: null,
      description: p.description ?? null,
      imageUrls: p.imageUrls ? JSON.parse(p.imageUrls) : [],
      publishedAt: p.firstSeen ?? Date.now(),
      updatedAt: p.lastSeen ?? Date.now(),
    };

    try {
      const enriched = await (adapter.enrichListing as (l: RawListing) => Promise<RawListing>)(raw);

      let name: string | null = enriched.contactName ?? null;
      let phone: string | null = enriched.contactPhone ?? null;
      let email: string | null = enriched.contactEmail ?? null;

      // Pravidlo "nikdy nesmažeme existující neprázdnou hodnotu"
      if (isEmpty(name)) name = p.contactName ?? null;
      if (isEmpty(phone)) phone = p.contactPhone ?? null;
      if (isEmpty(email)) {
        const cur = (p.contactEmail ?? "").toLowerCase().replace(/\.+$/, "");
        if (p.portalName === "realitymat" && GENERIC_PORTAL_EMAILS.includes(cur)) email = null;
        else email = p.contactEmail ?? null;
      }

      const changedNow =
        name !== p.contactName || phone !== p.contactPhone || email !== p.contactEmail;

      if (changedNow) {
        changed++;
        console.log(
          `  ${(p.portalName ?? "?").padEnd(14)} ${p.id.slice(0, 10)} | name: ${p.contactName ?? "—"} → ${name ?? "—"} | tel: ${p.contactPhone ?? "—"} → ${phone ?? "—"} | email: ${p.contactEmail ?? "—"} → ${email ?? "—"}`
        );
        if (APPLY) {
          await db
            .update(properties)
            .set({ contactName: name, contactPhone: phone, contactEmail: email })
            .where(eq(properties.id, p.id));
        }
      } else {
        kept++;
      }

      ok++;
    } catch (err) {
      failed++;
      await sleep(500);
    }
    await sleep(150);
  }

  console.log(`\nZpracováno: ${ok}, změn: ${changed}, beze změny: ${kept}, selhání: ${failed}`);
  if (!APPLY) console.log('\nDry-run — pro zápis do DB spusťte s "--apply".');
  process.exit(0);
}

main().catch((e) => {
  console.error("Obnova selhala:", e);
  process.exit(1);
});
