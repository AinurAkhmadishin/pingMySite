export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class SimpleRateLimiter {
  private readonly storage = new Map<string, number>();

  constructor(private readonly windowSeconds: number) {}

  check(key: string): RateLimitResult {
    const now = Date.now();
    const lastExecution = this.storage.get(key) ?? 0;
    const elapsedMs = now - lastExecution;
    const windowMs = this.windowSeconds * 1000;

    if (elapsedMs < windowMs) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((windowMs - elapsedMs) / 1000),
      };
    }

    this.storage.set(key, now);

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }
}
