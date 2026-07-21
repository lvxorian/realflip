import * as cheerio from "cheerio";

const BASE = "http://localhost:3000";

const TESTS = [
  { name: "sreality", url: "https://www.sreality.cz/detail/prodej/byt/3-kk/praha-vinohrady-italska/1234567890" },
  { name: "reality-cz", url: "https://www.reality.cz/nemovitosti/byty/prodej/ Praha/12345" },
  { name: "hyperinzerce", url: "https://byty.hyperinzerce.cz/detail/12345" },
  { name: "annonce", url: "https://www.annonce.cz/detail/12345" },
  { name: "bazos", url: "https://reality.bazos.cz/detail/12345" },
  { name: "mmreality", url: "https://www.mmreality.cz/detail/12345" },
  { name: "idnes-reality", url: "https://reality.idnes.cz/detail/12345" },
];

async function main() {
  console.log("Testing each portal's image scrapper via url-scraper...\n");

  for (const t of TESTS) {
    try {
      const res = await fetch(`${BASE}/api/analyze-url?url=${encodeURIComponent(t.url)}`);
      const data = await res.json();
      const imgCount = data?.listing?.imageUrls?.length ?? 0;
      const imgUrl = data?.listing?.imageUrls?.[0] ?? "none";
      console.log(`${t.name.padEnd(16)} images: ${imgCount}  first: ${imgUrl.slice(0, 80)}`);
    } catch (e) {
      console.log(`${t.name.padEnd(16)} ERROR: ${e.message}`);
    }
  }
}

main().catch(console.error);
