export const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export function isInvestorActive(lastActiveAt: number | null | undefined, now: number = Date.now()): boolean {
  return lastActiveAt != null && now - lastActiveAt <= ACTIVE_WINDOW_MS;
}
