export class RateLimiter {
  private static instance: RateLimiter;
  private lastRequestTime: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  async wait(domain: string, minIntervalMs: number = 2000): Promise<void> {
    const lastTime = this.lastRequestTime.get(domain) || 0;
    const now = Date.now();
    const elapsed = now - lastTime;

    if (elapsed < minIntervalMs) {
      const waitTime = minIntervalMs - elapsed + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime.set(domain, Date.now());
  }

  reset(): void {
    this.lastRequestTime.clear();
  }
}
