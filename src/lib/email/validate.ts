const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.trim().length <= 254 && EMAIL_RE.test(value.trim());
}

export function normalizeEmail(value: unknown): string | null {
  if (!isValidEmail(value)) return null;
  return value.trim().toLowerCase();
}
