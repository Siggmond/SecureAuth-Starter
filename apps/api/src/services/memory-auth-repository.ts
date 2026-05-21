import { randomUUID } from "node:crypto";
import type { Role } from "../auth/session-store";
import type { AuditEvent, AuditLogRecord, AuthRepository, UserRecord, UserSummary } from "./auth-repository";
import { toUserSummary } from "./auth-repository";

type TokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export class MemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly passwordResetTokens: TokenRecord[] = [];
  readonly emailVerificationTokens: TokenRecord[] = [];
  readonly auditLogs: AuditLogRecord[] = [];

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
    emailVerifiedAt?: Date | null;
  }): Promise<UserRecord> {
    if ([...this.users.values()].some((user) => user.email === input.email.toLowerCase())) {
      throw new Error("Unique constraint failed");
    }

    const now = new Date();
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role ?? "USER",
      emailVerifiedAt: input.emailVerifiedAt ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.passwordResetTokens.push({
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      usedAt: null
    });
  }

  async consumePasswordResetToken(tokenHash: string, now: Date): Promise<UserRecord | null> {
    const token = this.passwordResetTokens.find(
      (candidate) => candidate.tokenHash === tokenHash && !candidate.usedAt && candidate.expiresAt > now
    );
    if (!token) {
      return null;
    }

    token.usedAt = now;
    return this.users.get(token.userId) ?? null;
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.emailVerificationTokens.push({
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      usedAt: null
    });
  }

  async consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<UserRecord | null> {
    const token = this.emailVerificationTokens.find(
      (candidate) => candidate.tokenHash === tokenHash && !candidate.usedAt && candidate.expiresAt > now
    );
    if (!token) {
      return null;
    }

    token.usedAt = now;
    const user = this.users.get(token.userId);
    if (user) {
      user.emailVerifiedAt = user.emailVerifiedAt ?? now;
      user.updatedAt = now;
    }
    return user ?? null;
  }

  async listUsers(): Promise<UserSummary[]> {
    return [...this.users.values()].map(toUserSummary).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async updateUserRole(userId: string, role: Role): Promise<UserSummary | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    user.role = role;
    user.updatedAt = new Date();
    return toUserSummary(user);
  }

  async createAuditLog(event: AuditEvent): Promise<void> {
    this.auditLogs.push({
      id: randomUUID(),
      createdAt: new Date(),
      ...event
    });
  }

  async listAuditLogs(limit: number): Promise<AuditLogRecord[]> {
    return [...this.auditLogs]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit);
  }
}
