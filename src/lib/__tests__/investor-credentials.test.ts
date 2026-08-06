import { describe, it, expect } from "vitest";
import { deriveInvestorCredentials } from "../investor-credentials";

describe("deriveInvestorCredentials", () => {
  it("Jan Novák → jan / novak", () => {
    expect(deriveInvestorCredentials("Jan Novák")).toEqual({ username: "jan", password: "novak" });
  });

  it("odstraní diakritiku a převede na lowercase", () => {
    expect(deriveInvestorCredentials("Jana Řehořová")).toEqual({ username: "jana", password: "rehorova" });
    expect(deriveInvestorCredentials("PETR ŠTÍCHA")).toEqual({ username: "petr", password: "sticha" });
    expect(deriveInvestorCredentials("Eva Černá  Žůrková")).toEqual({ username: "eva", password: "zurkova" });
  });

  it("ignoruje přípony ml./st./jun. při výběru příjmení", () => {
    expect(deriveInvestorCredentials("Jan Novák ml.")).toEqual({ username: "jan", password: "novak" });
    expect(deriveInvestorCredentials("Jiří Dvořák st.")).toEqual({ username: "jiri", password: "dvorak" });
  });

  it("jméno bez příjmení → password null", () => {
    expect(deriveInvestorCredentials("Monika")).toEqual({ username: "monika", password: null });
    expect(deriveInvestorCredentials("")).toEqual({ username: "", password: null });
  });

  it("víc jmen → první token jako username, poslední jako heslo", () => {
    expect(deriveInvestorCredentials("Jan Petr Novák")).toEqual({ username: "jan", password: "novak" });
  });
});
