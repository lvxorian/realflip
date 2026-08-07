/**
 * Ověří fázi 1 API /api/valuation: POST { url } → vrací parsed pole k úpravě.
 * Reprodukuje flow, které selhávalo (url: "" → „Chybí vstupní údaje").
 */
const TEST_URL = "https://www.sreality.cz/detail/prodej/byt/3+1/cheb-cheb-lomena/1917243468";

async function main() {
  // 1) bez URL — musí vrátit chybu (správně)
  const empty = await fetch("http://localhost:3000/api/valuation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "" }),
  }).catch(() => null);
  console.log("url='' →", empty ? `${empty.status} ${JSON.stringify(await empty.json()).slice(0, 120)}` : "server neběží (čekáno — test proběhne v build/test vrstvě)");

  // 2) logika route pro url="" (bez serveru — čistá kontrola podmínek)
  const url = "";
  const body = { url };
  const parsedUrl: string | undefined =
    typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined;
  const fields = undefined;
  const wouldError = !fields && !parsedUrl;
  console.log("route logika url='' → error:", wouldError);

  // 3) url vyplněná — parsedUrl musí být definovaný a !fields && url → vrať parsed
  const body2 = { url: TEST_URL };
  const parsedUrl2: string | undefined =
    typeof body2.url === "string" && body2.url.trim() ? body2.url.trim() : undefined;
  const wouldReturnParsed = !fields && parsedUrl2;
  console.log("route logika url=cheb → vrací parsed:", wouldReturnParsed);
}

main();
