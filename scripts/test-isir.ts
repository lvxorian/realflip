import { getLastPodnetId, getEventData } from "../src/lib/isir/isir-client";
import { hasApartmentReference, extractDisposition, extractArea, extractAddress, extractEstimatedPrice } from "../src/lib/isir/apartment-parser";

const SAMPLE_TEXTS = [
  "Bytová jednotka č. 1234/5, dispozice 2+kk, o výměře 54 m²",
  "Jednotka č. 456/12 zapsaná na LV č. 789, k.ú. Vinohrady",
  "Byt 3+1 v původním stavu, ul. Dlouhá 15, Praha 1",
  "Garsoniéra o velikosti 28 m², ul. Křenová, Brno",
  "Nemovitost: pozemek parcela č. 123/45, k.ú. Modřany",
  "Toto je obyčejný text bez zmínky o nemovitosti",
];

(async () => {
  console.log("=== ISIR API Test ===\n");

  try {
    console.log("1. Testing getLastPodnetId()...");
    const lastId = await getLastPodnetId();
    console.log(`   Last Podnet ID: ${lastId}`);
    console.log(`   OK\n`);

    console.log("2. Testing getEventData(lastId)...");
    const events = await getEventData(lastId);
    console.log(`   Events for ID ${lastId}: ${events.length}`);
    if (events.length > 0) {
      const e = events[0];
      console.log(`   First event:`);
      console.log(`     spisovaZnacka: ${e.spisovaZnacka}`);
      console.log(`     typUdalosti: ${e.typUdalosti}`);
      console.log(`     popisUdalosti: ${e.popisUdalosti}`);
      console.log(`     oddil: ${e.oddil}`);
    }
    console.log(`   OK\n`);

    console.log("3. Testing getEventData(80115400)...");
    const events2 = await getEventData(80115400);
    console.log(`   Events for ID 80115400: ${events2.length}`);
    if (events2.length > 0) {
      const e = events2[0];
      console.log(`   First event:`);
      console.log(`     spisovaZnacka: ${e.spisovaZnacka}`);
      console.log(`     popisUdalosti: ${e.popisUdalosti}`);
      console.log(`     oddil: ${e.oddil}`);
    }
    console.log(`   OK\n`);
  } catch (err) {
    console.error(`   ERROR: ${err}\n`);
  }

  console.log("=== Apartment Regex Test ===\n");

  for (const text of SAMPLE_TEXTS) {
    const hasApartment = hasApartmentReference(text);
    const disposition = extractDisposition(text);
    const area = extractArea(text);
    const address = extractAddress(text);
    const price = extractEstimatedPrice(text);

    console.log(`Text: "${text}"`);
    console.log(`  Match: ${hasApartment ? "YES" : "no"}`);
    if (hasApartment) {
      console.log(`  Disposition: ${disposition ?? "—"}`);
      console.log(`  Area: ${area ? `${area} m²` : "—"}`);
      console.log(`  Address: ${address ?? "—"}`);
      console.log(`  Price: ${price ? `${price} Kč` : "—"}`);
    }
    console.log();
  }

  console.log("Done!");
})();
