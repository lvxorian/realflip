import type { PortalName } from "./types";

export async function createScrapingOrchestrator(
  onProgress?: (portal: PortalName, found: number, errors: string[]) => void
) {
  const [
    { ScrapingOrchestrator },
    { BazosAdapter },
    { MmrealityAdapter },
    { AnnonceAdapter },
    { RealityCzAdapter },
    { HyperinzerceAdapter },
    { SrealityAdapter },
    { IdnesRealityAdapter },
    { RealityMatAdapter },
    { RealityMixAdapter },
    { BezrealitkyAdapter },
    { RemaxAdapter },
  ] = await Promise.all([
    import("./orchestrator"),
    import("./adapters/bazos"),
    import("./adapters/mmreality"),
    import("./adapters/annonce"),
    import("./adapters/reality-cz"),
    import("./adapters/hyperinzerce"),
    import("./adapters/sreality"),
    import("./adapters/idnes-reality"),
    import("./adapters/realitymat"),
    import("./adapters/realitymix"),
    import("./adapters/bezrealitky"),
    import("./adapters/remax"),
  ]);

  const orchestrator = new ScrapingOrchestrator(onProgress);
  orchestrator.registerAdapter("bazos", new BazosAdapter());
  orchestrator.registerAdapter("mmreality", new MmrealityAdapter());
  orchestrator.registerAdapter("annonce", new AnnonceAdapter());
  orchestrator.registerAdapter("reality-cz", new RealityCzAdapter());
  orchestrator.registerAdapter("hyperinzerce", new HyperinzerceAdapter());
  orchestrator.registerAdapter("sreality", new SrealityAdapter());
  orchestrator.registerAdapter("idnes-reality", new IdnesRealityAdapter());
  orchestrator.registerAdapter("realitymat", new RealityMatAdapter());
  orchestrator.registerAdapter("realitymix", new RealityMixAdapter());
  orchestrator.registerAdapter("bezrealitky", new BezrealitkyAdapter());
  orchestrator.registerAdapter("remax", new RemaxAdapter());
  return orchestrator;
}