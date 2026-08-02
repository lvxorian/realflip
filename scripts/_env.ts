import fs from "node:fs";
import path from "node:path";

// Načte .env.local před importem db (tsx skripty nemají Next.js env loading)
const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
}
