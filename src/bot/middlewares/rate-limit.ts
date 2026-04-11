import { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export class RedisRateLimiter {
  constructor(
    private readonly redis: Redis,
    private readonly windowSeconds: number,
    private readonly namespace = "rate-limit",
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const redisKey = `${this.namespace}:${key}`;
    const created = await this.redis.set(redisKey, Date.now().toString(), "EX", this.windowSeconds, "NX");

    if (created === "OK") {
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    const ttlSeconds = await this.redis.ttl(redisKey);

    return {
      allowed: false,
      retryAfterSeconds: ttlSeconds > 0 ? ttlSeconds : this.windowSeconds,
    };
  }
}
