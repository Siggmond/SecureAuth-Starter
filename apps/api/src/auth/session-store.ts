import type { Request, Response } from "express";
import { parse, serialize } from "cookie";
import type { AppEnv } from "../config/env";
import { hmacSha256, randomToken, safeEqual, sha256 } from "../lib/crypto";
import type { KeyValueStore } from "../services/key-value-store";

export type Role = "USER" | "ADMIN";

export type SessionData = {
  csrfSecret: string;
  createdAt: string;
  lastSeenAt: string;
  absoluteExpiresAt: string;
  userId?: string;
  role?: Role;
};

export type SessionRecord = {
  rawId: string;
  storageKey: string;
  data: SessionData;
};

export const SESSION_COOKIE_NAME = "secureauth.sid";

export class SessionStore {
  private readonly idleSeconds: number;
  private readonly absoluteSeconds: number;
  private readonly secureCookies: boolean;

  constructor(
    private readonly store: KeyValueStore,
    private readonly env: Pick<AppEnv, "SESSION_SECRET" | "SESSION_IDLE_MINUTES" | "SESSION_ABSOLUTE_HOURS" | "NODE_ENV">
  ) {
    this.idleSeconds = env.SESSION_IDLE_MINUTES * 60;
    this.absoluteSeconds = env.SESSION_ABSOLUTE_HOURS * 60 * 60;
    this.secureCookies = env.NODE_ENV === "production";
  }

  async createAnonymousSession(): Promise<SessionRecord> {
    return this.createSession({});
  }

  async createAuthenticatedSession(userId: string, role: Role): Promise<SessionRecord> {
    return this.createSession({ userId, role });
  }

  async readFromRequest(req: Request): Promise<SessionRecord | null> {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      return null;
    }

    const cookies = parse(cookieHeader);
    const signedValue = cookies[SESSION_COOKIE_NAME];
    if (!signedValue) {
      return null;
    }

    const rawId = this.verifySignedSessionId(signedValue);
    if (!rawId) {
      return null;
    }

    const storageKey = this.storageKey(rawId);
    const data = await this.store.getJson<SessionData>(storageKey);
    if (!data || this.isExpired(data)) {
      await this.destroyByRawId(rawId);
      return null;
    }

    const touched: SessionData = {
      ...data,
      lastSeenAt: new Date().toISOString()
    };
    const ttlSeconds = this.ttlSeconds(touched);
    if (ttlSeconds <= 0) {
      await this.destroyByRawId(rawId);
      return null;
    }

    await this.store.setJson(storageKey, touched, ttlSeconds);
    return {
      rawId,
      storageKey,
      data: touched
    };
  }

  async destroy(record: SessionRecord): Promise<void> {
    await this.destroyByRawId(record.rawId, record.data.userId);
  }

  async destroyUserSessions(userId: string): Promise<void> {
    const setKey = this.userSessionsKey(userId);
    const keys = await this.store.getSetMembers(setKey);

    await Promise.all(keys.map((key) => this.store.delete(key)));
    await this.store.delete(setKey);
  }

  setCookie(res: Response, record: SessionRecord): void {
    res.setHeader("Set-Cookie", this.cookieHeader(record.rawId, this.idleSeconds));
  }

  clearCookie(res: Response): void {
    res.setHeader("Set-Cookie", this.clearCookieHeader());
  }

  csrfToken(record: SessionRecord): string {
    return hmacSha256("csrf-token:v1", record.data.csrfSecret);
  }

  verifyCsrfToken(record: SessionRecord, submitted: string | undefined): boolean {
    if (!submitted) {
      return false;
    }

    return safeEqual(this.csrfToken(record), submitted);
  }

  private async createSession(identity: Pick<SessionData, "userId" | "role">): Promise<SessionRecord> {
    const rawId = randomToken(48);
    const now = new Date();
    const data: SessionData = {
      csrfSecret: randomToken(32),
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      absoluteExpiresAt: new Date(now.getTime() + this.absoluteSeconds * 1000).toISOString(),
      ...identity
    };
    const storageKey = this.storageKey(rawId);
    const ttlSeconds = this.ttlSeconds(data);

    await this.store.setJson(storageKey, data, ttlSeconds);

    if (data.userId) {
      await this.store.addToSet(this.userSessionsKey(data.userId), storageKey, this.absoluteSeconds);
    }

    return {
      rawId,
      storageKey,
      data
    };
  }

  private async destroyByRawId(rawId: string, userId?: string): Promise<void> {
    const storageKey = this.storageKey(rawId);
    await this.store.delete(storageKey);

    if (userId) {
      await this.store.removeFromSet(this.userSessionsKey(userId), storageKey);
    }
  }

  private isExpired(data: SessionData): boolean {
    const now = Date.now();
    const idleExpiresAt = new Date(data.lastSeenAt).getTime() + this.idleSeconds * 1000;
    const absoluteExpiresAt = new Date(data.absoluteExpiresAt).getTime();
    return now >= idleExpiresAt || now >= absoluteExpiresAt;
  }

  private ttlSeconds(data: SessionData): number {
    const absoluteRemaining = Math.floor((new Date(data.absoluteExpiresAt).getTime() - Date.now()) / 1000);
    return Math.min(this.idleSeconds, absoluteRemaining);
  }

  private storageKey(rawId: string): string {
    return `session:${sha256(rawId)}`;
  }

  private userSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  private signSessionId(rawId: string): string {
    return `${rawId}.${hmacSha256(rawId, this.env.SESSION_SECRET)}`;
  }

  private verifySignedSessionId(value: string): string | null {
    const [rawId, signature] = value.split(".");
    if (!rawId || !signature) {
      return null;
    }

    const expected = hmacSha256(rawId, this.env.SESSION_SECRET);
    return safeEqual(expected, signature) ? rawId : null;
  }

  private cookieHeader(rawId: string, maxAgeSeconds: number): string {
    return serialize(SESSION_COOKIE_NAME, this.signSessionId(rawId), {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
      maxAge: maxAgeSeconds
    });
  }

  private clearCookieHeader(): string {
    return serialize(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookies,
      path: "/",
      maxAge: 0
    });
  }
}
