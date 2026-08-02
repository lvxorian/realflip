export async function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/ld+json, application/json, text/csv, */*",
      "User-Agent": "RealFlip/1.0 (locality intelligence)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("utf8");
}

export async function fetchBuffer(url: string, timeoutMs = 60000): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RealFlip/1.0 (locality intelligence)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
