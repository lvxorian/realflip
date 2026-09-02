import { describe, it, expect } from "vitest";
import { parseRealingoPagePhotos } from "../page-photos";

const ABS = "https://www.realingo.cz/static/images/offer/ya2/ya2xfmdz53-1278x718xf0f0f0";
const REL_1 = "/static/images/offer/xdd/xdda7jrd8v-1278x718xd0d0d0";
const REL_2 = "/static/images/offer/kkg/kkguzc1ajv-1278x718xd0d0d0";

describe("parseRealingoPagePhotos", () => {
  it("extrahuje absolutni i relativni url a doplni domenu", () => {
    const html = `<meta property="og:image" content="${ABS}.jpg?w=1440"/><img src="${REL_1}.webp"/>`;
    const out = parseRealingoPagePhotos(html);
    expect(out).toEqual([`${ABS}.jpg`, `https://www.realingo.cz${REL_1}.webp`]);
  });

  it("sluci webp+jpg tehoz basenameu na jpg (preferuji jpg)", () => {
    const html = `<source srcset="${REL_1}.webp"/><img src="${REL_1}.jpg"/>`;
    const out = parseRealingoPagePhotos(html);
    expect(out).toEqual([`https://www.realingo.cz${REL_1}.jpg`]);
  });

  it("neradi zamenenem poradi - jpg prisel driv nez webp", () => {
    const html = `<img src="${ABS}.jpg"/><source srcset="${ABS}.webp"/>`;
    const out = parseRealingoPagePhotos(html);
    expect(out).toEqual([`${ABS}.jpg`]);
  });

  it("ohrani Max 10 fotek", () => {
    const many = Array.from(
      { length: 14 },
      (_, i) => `<img src="/static/images/offer/xx/i${i}-1278x718x000000.jpg"/>`
    ).join("");
    expect(parseRealingoPagePhotos(many)).toHaveLength(10);
  });

  it("prehledne placeholder/no-image", () => {
    const html = `<img src="/static/images/offer/zz/placeholder-1x1x0.jpg"/><img src="${REL_2}.jpg"/>`;
    expect(parseRealingoPagePhotos(html)).toEqual([`https://www.realingo.cz${REL_2}.jpg`]);
  });

  it("prazdne html -> []", () => {
    expect(parseRealingoPagePhotos("<html></html>")).toEqual([]);
  });
});
