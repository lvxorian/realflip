import * as crypto from "crypto";

export class Deduplicator {
  private seenHashes: Set<string> = new Set();

  hash(url: string, title: string): string {
    const normalized = `${url.toLowerCase().trim()}|${title.toLowerCase().trim()}`;
    return crypto.createHash("md5").update(normalized).digest("hex");
  }

  isDuplicate(url: string, title: string): boolean {
    const h = this.hash(url, title);
    if (this.seenHashes.has(h)) return true;
    this.seenHashes.add(h);
    return false;
  }

  clear(): void {
    this.seenHashes.clear();
  }

  get size(): number {
    return this.seenHashes.size;
  }
}
