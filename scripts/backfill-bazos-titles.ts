import "./_env";
import { neon } from "@neondatabase/serverless";
import {
  GENERIC_PLACE_TOKENS,
  CITY_TOKENS,
} from "../src/lib/scraping/property-match";
import { tokenize } from "../src/lib/scraping/relisting";

/**
 * Backfill: bazos.cz ořezává titulky inzerátů na 60 znaků (jeho limit — plný
 * text na jeho stránkách nikde neexistuje, ověřeno živě). Pokud je stejná
 * nemovitost v DB i z jiného portálu s plným titulkem, přepíšeme ořezaný
 * titulek plným. Idempotentní — UPDATE zasáhne jen řádky, kde najdeme
 * důvěryhodné dvojče (stejná dispozice + plocha ±3 m² + cena ±15 % +
 * konzervativní obsahová shoda adresy z property-match).
 */
function betterTitle(current: string, incoming: string): string | null {
  // Nahrazujeme JEN delším (plnějším) titulkem — nikdy kratším, aby se
  // neztratily údaje (ulice apod.), které bazos titulek obsahuje.
  return incoming.length > current.length ? incoming : null;
}

/**
 * Shoda bazos TITULKU s adresou dvojčete: bazos má v DB adresu jen jako
 * „město, PSČ" (ulice je jen v titulku), takže klasický matcher adres nic
 * nenajde. Hledáme tedy výrazné tokeny titulku (ulice, čtvrť) v adrese
 * kandidáta — mimo generická místopisná slova (města, okresy…).
 */
function titleMatchesCandidateAddress(
  bazosTitle: string,
  candidateAddress: string | null
): boolean {
  if (!candidateAddress) return false;
  const addrTokens = new Set(tokenize(candidateAddress));
  const titleTokens = tokenize(bazosTitle).filter(
    (t) =>
      t.length >= 4 &&
      !GENERIC_PLACE_TOKENS.has(t) &&
      !CITY_TOKENS.has(t)
  );
  return titleTokens.some((t) => addrTokens.has(t));
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const bazos = await sql`
    SELECT id, title, address, rooms, area, price
    FROM properties
    WHERE portal_name = 'bazos' AND char_length(title) = 60
  `;
  console.log(`bazos záznamů s 60znakovým (ořezaným) titulkem: ${bazos.length}`);

  let fixed = 0;
  let noTwin = 0;
  let skipped = 0;

  for (const b of bazos) {
    const cands = await sql`
      SELECT id, portal_name, title, address, rooms, area, price, last_seen, is_active
      FROM properties
      WHERE portal_name <> 'bazos' AND is_active = 1
        AND rooms IS NOT NULL AND rooms = ${b.rooms}
        AND abs(area - ${b.area}) <= 3
        AND abs(price - ${b.price}) <= ${Number(b.price) * 0.15}
      LIMIT 20
    `;

    let best: (typeof cands)[number] | null = null;
    for (const c of cands) {
      // bazos adresa je jen „město, PSČ" → konzervativní matcher adres nestačí;
      // porovnej výrazné tokeny bazos titulku (ulice/čtvrť) s adresou kandidáta.
      if (!titleMatchesCandidateAddress(String(b.title), c.address as string | null)) continue;
      if (!best || (c.title ?? "").length > (best.title ?? "").length) best = c;
    }

    if (!best) {
      noTwin++;
      continue;
    }

    const twinTitle = best.title ?? "";
    const next = betterTitle(String(b.title), twinTitle);
    if (!next || next === String(b.title)) {
      skipped++;
      continue;
    }

    await sql`UPDATE properties SET title = ${next} WHERE id = ${b.id}`;
    // Verifikace — potvrď, že se zápis skutečně uložil.
    const verify = await sql`SELECT title FROM properties WHERE id = ${b.id}`;
    const persisted = verify[0]?.title === next;
    fixed++;
    console.log(
      `  ${persisted ? "FIX" : "NEPERSISTOVALO"} ${String(b.id).slice(0, 8)}: "${String(b.title).slice(0, 60)}" → "${twinTitle.slice(0, 80)}" (z ${best.portal_name})${persisted ? "" : " — POZOR!"}`
    );
  }

  console.log(`\nOpraveno: ${fixed} | bez dvojčete: ${noTwin} | přeskočeno: ${skipped}`);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
