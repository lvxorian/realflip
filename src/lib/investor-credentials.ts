const DIACRITICS_MAP: Record<string, string> = {
  á: "a", č: "c", ď: "d", é: "e", ě: "e", í: "i", ň: "n",
  ó: "o", ř: "r", š: "s", ť: "t", ú: "u", ů: "u", ý: "y", ž: "z",
};

/** Odstraní českou diakritiku, převede na lowercase a nechá jen a–z0–9. */
function normalizePart(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => DIACRITICS_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

const SUFFIX_PATTERNS = /^(ml|mladsi|st|starsl|starsi|jun|junior|jr|snr)\.?$/i;

/**
 * Odvodí přihlašovací údaje investora z jeho jména:
 * username = křestní jméno, password = příjmení (bez diakritiky, lowercase).
 * Pokud jméno nemá alespoň 2 slova, vrátí password null.
 */
export function deriveInvestorCredentials(name: string): { username: string; password: string | null } {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return { username: "", password: null };

  const username = normalizePart(parts[0]);
  if (parts.length < 2) return { username, password: null };

  let lastName = parts[parts.length - 1];
  if (parts.length >= 2 && SUFFIX_PATTERNS.test(lastName)) {
    lastName = parts[parts.length - 2];
  }
  const password = normalizePart(lastName);

  return { username, password: password || null };
}
