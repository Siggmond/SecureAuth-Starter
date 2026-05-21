import type { Role } from "../auth/session-store";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserSummary = Omit<UserRecord, "passwordHash">;

export type AuditEvent = {
  action: string;
  success: boolean;
  userId?: string;
  emailHash?: string;
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AuditLogRecord = AuditEvent & {
  id: string;
  createdAt: Date;
};

export interface AuthRepository {
  createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
    emailVerifiedAt?: Date | null;
  }): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumePasswordResetToken(tokenHash: string, now: Date): Promise<UserRecord | null>;
  createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<UserRecord | null>;
  listUsers(): Promise<UserSummary[]>;
  updateUserRole(userId: string, role: Role): Promise<UserSummary | null>;
  createAuditLog(event: AuditEvent): Promise<void>;
  listAuditLogs(limit: number): Promise<AuditLogRecord[]>;
}

export function toUserSummary(user: UserRecord): UserSummary {
  const { passwordHash: _passwordHash, ...summary } = user;
  return summary;
}
