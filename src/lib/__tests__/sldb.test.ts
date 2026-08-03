import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ then: vi.fn() })) })) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ set: vi.fn() })) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  },
}));

vi.mock("../locality/nkod", () => ({
  resolveNkodDownloadUrl: vi.fn((iri: string) => Promise.resolve(`https://mock.csu.gov.cz/${iri.slice(-8)}`)),
}));

import { fetchAgeStructure, fetchFirmsPerCity } from "../locality/sldb";

function fakeResponse(text: string) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(encoder.encode(text).buffer as ArrayBuffer),
  } as unknown as Response;
}

function fakeBinaryResponse(buffer: ArrayBuffer) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(buffer),
  } as unknown as Response;
}

function zipStored(entryName: string, content: string): ArrayBuffer {
  const data = new TextEncoder().encode(content);
  const name = new TextEncoder().encode(entryName);
  const localLen = 30 + name.length + data.length;

  const header = new Uint8Array(46);
  const dv = new DataView(header.buffer);
  dv.setUint32(0, 0x02014b50, true); // central dir sig
  dv.setUint16(10, 0, true); // method stored
  dv.setUint32(20, data.length, true);
  dv.setUint16(28, name.length, true);
  dv.setUint32(42, 0, true); // local header offset

  const cdLen = header.length + name.length;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true); // EOCD sig
  edv.setUint16(8, 1, true); // entries on disk
  edv.setUint16(10, 1, true); // total entries
  edv.setUint32(12, cdLen, true); // CD size
  edv.setUint32(16, localLen, true); // CD offset

  const buf = new Uint8Array(localLen + cdLen + eocd.length);
  const ldv = new DataView(buf.buffer);
  ldv.setUint32(0, 0x04034b50, true); // local header sig
  ldv.setUint16(8, 0, true); // method stored
  ldv.setUint32(18, data.length, true);
  ldv.setUint16(26, name.length, true);
  buf.set(name, 30);
  buf.set(data, 30 + name.length);
  buf.set(header, localLen);
  buf.set(name, localLen + 46);
  buf.set(eocd, localLen + cdLen);
  return buf.buffer as ArrayBuffer;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAgeStructure (SLDB 2021, per ORP)", () => {
  it("spočítá podíl 65+ per cityKey", async () => {
    const csv = [
      '"idhod","hodnota","stapro_kod","pohlavi_cis","pohlavi_kod","vek_cis","vek_kod","vuzemi_cis","vuzemi_kod","casref_do","pohlavi_txt","vek_txt","vuzemi_txt"',
      '"1","1000","2406","101","1","7700","x","65","1000","2021-12-31","muž","30 a 31 (více nebo rovno 30 a méně než 31)","Brno"',
      '"2","1000","2406","101","1","7700","x","65","1000","2021-12-31","muž","70 a 71 (více nebo rovno 70 a méně než 71)","Brno"',
      '"3","100","2406","101","1","7700","x","65","1000","2021-12-31","muž","Od 100 (více nebo rovno 100)","Brno"',
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(csv)));

    const { byCity, period } = await fetchAgeStructure();
    expect(period).toBe("2021");
    // total 2100, over65 = 1100 → 52.4 %
    expect(byCity.brno.share65plus).toBeCloseTo(52.4, 1);
    expect(byCity.brno.population).toBe(2100);
  });

  it("ignoruje cizí obce (žádná přesná shoda)", async () => {
    const csv = [
      '"idhod","hodnota","stapro_kod","pohlavi_cis","pohlavi_kod","vek_cis","vek_kod","vuzemi_cis","vuzemi_kod","casref_do","pohlavi_txt","vek_txt","vuzemi_txt"',
      '"1","500","2406","101","1","7700","x","65","1000","2021-12-31","muž","30 a 31 (více nebo rovno 30 a méně než 31)","Starý Plzenec"',
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(csv)));
    const { byCity } = await fetchAgeStructure();
    // "Starý Plzenec" se nemapuje na plzen (přesná shoda selže)
    expect(byCity.plzen).toBeUndefined();
  });
});

describe("fetchFirmsPerCity (ČSÚ RES, per obec)", () => {
  it("vyčte souhrnný počet subjektů per cityKey", async () => {
    const csv = [
      '"idhod","hodnota","stapro_kod","aktivita_cis","aktivita_kod","forma_cis","forma_kod","vuzemi_cis","vuzemi_kod","casref","aktivita_txt","forma_txt","vuzemi_txt"',
      '"1","692397","4958",,,,,"43","554782","2025-12-31",,,"Praha"',
      '"2","12345","4958",,,"56","101","43","554782","2025-12-31",,"Fyzická osoba","Praha"',
      '"3","999","4958",,,,,"65","1000","2025-12-31",,,"Praha"',
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeBinaryResponse(zipStored("OD_ORG01q_2025.CSV", csv))));

    const { byCity, period } = await fetchFirmsPerCity();
    expect(period).toBe("2025-Q4");
    // Souhrnný řádek (prázdná forma i aktivita) → 692397; per-forma řádky ignorovány
    expect(byCity.praha).toBe(692397);
  });
});
