import Redis from "ioredis";

export interface KeyValueStore {
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  addToSet(key: string, value: string, ttlSeconds: number): Promise<void>;
  getSetMembers(key: string): Promise<string[]>;
  removeFromSet(key: string, value: string): Promise<void>;
}

export class RedisKeyValueStore implements KeyValueStore {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true
    });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds, "NX");
    const results = await pipeline.exec();
    const count = results?.[0]?.[1];
    return typeof count === "number" ? count : 0;
  }

  async addToSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(key, value);
    pipeline.expire(key, ttlSeconds);
    await pipeline.exec();
  }

  async getSetMembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    await this.redis.srem(key, value);
  }
}

type MemoryValue = {
  value: string | number | Set<string>;
  expiresAt: number;
};

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, MemoryValue>();

  async getJson<T>(key: string): Promise<T | null> {
    const value = this.getFreshValue(key);
    if (typeof value !== "string") {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.values.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = this.getFreshValue(key);
    const next = typeof current === "number" ? current + 1 : 1;
    this.values.set(key, {
      value: next,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    return next;
  }

  async addToSet(key: string, value: string, ttlSeconds: number): Promise<void> {
    const current = this.getFreshValue(key);
    const set = current instanceof Set ? current : new Set<string>();
    set.add(value);
    this.values.set(key, {
      value: set,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  async getSetMembers(key: string): Promise<string[]> {
    const current = this.getFreshValue(key);
    return current instanceof Set ? [...current] : [];
  }

  async removeFromSet(key: string, value: string): Promise<void> {
    const current = this.getFreshValue(key);
    if (current instanceof Set) {
      current.delete(value);
    }
  }

  clear(): void {
    this.values.clear();
  }

  private getFreshValue(key: string): MemoryValue["value"] | null {
    const entry = this.values.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }

    return entry.value;
  }
}
