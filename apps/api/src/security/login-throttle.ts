import type { KeyValueStore } from "../services/key-value-store";
import { hashIdentifier } from "../lib/crypto";

export class LoginThrottle {
  constructor(
    private readonly store: KeyValueStore,
    private readonly secret: string,
    private readonly baseDelayMs: number
  ) {}

  async delayFor(email: string, ip: string): Promise<void> {
    if (this.baseDelayMs === 0) {
      return;
    }

    const key = this.key(email, ip);
    const failures = (await this.store.getJson<number>(key)) ?? 0;
    if (failures < 3) {
      return;
    }

    const delayMs = Math.min(this.baseDelayMs * 2 ** (failures - 3), 8_000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  async recordFailure(email: string, ip: string): Promise<void> {
    await this.store.increment(this.key(email, ip), 900);
  }

  async reset(email: string, ip: string): Promise<void> {
    await this.store.delete(this.key(email, ip));
  }

  private key(email: string, ip: string): string {
    return `login_failures:${hashIdentifier(`${email}:${ip}`, this.secret)}`;
  }
}
