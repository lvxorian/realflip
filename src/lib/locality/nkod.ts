import { fetchText } from "./http";

interface GraphNode {
  "@id"?: string;
  "@type"?: string | string[];
  downloadURL?: string;
  accessURL?: string;
  distribution?: string;
  title?: { "@value"?: string };
}

/**
 * Vyřeší aktuální download URL datové sady ČSÚ registrované v NKOD (Národní katalog otevřených dat).
 * NKOD je stabilní bod; konkrétní hashované ZIP odkazy na csu.gov.cz se měsíčně mění.
 * `datasetIri` je NKOD IRI ve tvaru https://data.gov.cz/zdroj/datov%C3%A9-sady/00025593/<hash>.
 */
export async function resolveNkodDownloadUrl(datasetIri: string): Promise<string> {
  const doc = JSON.parse(await fetchText(datasetIri));

  const nodes: GraphNode[] = Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc];
  const dataset = nodes.find((n) => n["@id"] === datasetIri) ?? nodes[0];
  const distIri = dataset?.distribution;
  if (!distIri) throw new Error(`NKOD: no distribution for ${datasetIri}`);

  const distDoc = JSON.parse(await fetchText(distIri));
  const distNodes: GraphNode[] = Array.isArray(distDoc["@graph"]) ? distDoc["@graph"] : [distDoc];
  const dist = distNodes.find((n) => n["@id"] === distIri) ?? distNodes[0];
  const url = dist?.downloadURL ?? dist?.accessURL;
  if (!url) throw new Error(`NKOD: no download URL for ${datasetIri}`);
  return url;
}
