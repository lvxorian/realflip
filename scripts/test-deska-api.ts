import { searchDocuments } from "../src/lib/deska/edesky-client";
import { classifyDocument } from "../src/lib/deska/classify";

const queries = [
  { keywords: "dražba nemovitosti", expected: "DRAZBA" },
  { keywords: "exekuce", expected: "EXEKUCE" },
  { keywords: "odúmrtí dědiců", expected: "DEDICTVI" },
  { keywords: "stavební řízení", expected: "STAVEBNI_RIZENI" },
];

(async () => {
  for (const q of queries) {
    const r = await searchDocuments({ keywords: q.keywords, order: "date" });
    console.log(`\n=== "${q.keywords}" → ${r.totalCount} docs ===`);
    for (const d of r.documents.slice(0, 2)) {
      const { category, relevance } = classifyDocument(d.name);
      console.log(`  [${category}/${relevance}] ${d.name} — ${d.dashboard_name}`);
    }
  }
})();
