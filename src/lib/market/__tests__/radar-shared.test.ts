import { describe, it, expect } from "vitest";
import {
  extractBladeGraphData,
  bladeSeriesToPoints,
  czDecimal,
  quarterToPeriod,
  dateToPeriod,
  regionTypeOf,
  regionLabel,
} from "../radar-shared";

describe("extractBladeGraphData", () => {
  it("zparsuje multi-line JSON bez koncového středníku", () => {
    const html = `...<script>var blade_graphData = {
  "graph_data": [
    { "1": { "x": "1/1/2020", "y": "8.89" }, "2": { "x": "2/1/2020", "y": "9.0" } }
  ]
}
</script>...`;
    const series = extractBladeGraphData(html);
    expect(series).toHaveLength(1);
    expect(series![0]["1"]).toEqual({ x: "1/1/2020", y: "8.89" } as never);
  });

  it("vrátí null, když se blade_graphData nevyskytuje", () => {
    expect(extractBladeGraphData("<html></html>")).toBeNull();
  });
});

describe("bladeSeriesToPoints", () => {
  it("převede body (y jako stringy) na periodu a číslo, seřadí", () => {
    const points = bladeSeriesToPoints({
      a: { x: "2/1/2026", y: "4.9" },
      b: { x: "1/31/2026", y: 5.1 },
      c: { x: "", y: 1 },
    } as never);
    expect(points).toEqual([
      ["2026-01", 5.1],
      ["2026-02", 4.9],
    ]);
  });
});

describe("česká desetinná čárka", () => {
  it("konvertuje čárku na tečku", () => {
    expect(czDecimal("11,30")).toBe(11.3);
  });
});

describe("quarterToPeriod", () => {
  it("mapuje kvartál na poslední měsíc", () => {
    expect(quarterToPeriod("2026-Q3")).toBe("2026-09");
    expect(quarterToPeriod("2025-Q1")).toBe("2025-03");
  });
});

describe("dateToPeriod", () => {
  it("formátuje datum na YYYY-MM", () => {
    expect(dateToPeriod(new Date(2026, 0, 15))).toBe("2026-01");
  });
});

describe("regionTypeOf", () => {
  it("rozliší cr, kraj a město", () => {
    expect(regionTypeOf("cr")).toBe("cr");
    expect(regionTypeOf("praha")).toBe("kraj");
    expect(regionTypeOf("cheb")).toBe("city");
  });
});

describe("regionLabel", () => {
  it("vrátí český název", () => {
    expect(regionLabel("cr")).toBe("Česká republika");
    expect(regionLabel("jihomoravsky")).toBe("Jihomoravský kraj");
    expect(regionLabel("neznámo")).toBe("neznámo");
  });
});