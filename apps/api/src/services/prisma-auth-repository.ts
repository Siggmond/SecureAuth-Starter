import type { Prisma, PrismaClient } from "@prisma/client";
import type { Role } from "../auth/session-store";
import type { AuditEvent, AuditLogRecord, AuthRepository, UserRecord, UserSummary } from "./auth-repository";

function mapUser(user: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return user;
}

function sanitizeMetadata(metadata: AuditEvent["metadata"]): Prisma.InputJsonObject | undefined {
  return metadata ? { ...metadata } : undefined;
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(input: {
    email: string;
    name: string;
    passwordHash: string;
    role?: Role;
    emailVerifiedAt?: Date | null;
  }): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role ?? "USER",
        emailVerifiedAt: input.emailVerifiedAt ?? null
      }
    });

    return mapUser(user);
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { id }
    });

    return user ? mapUser(user) : null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });
  }

  async consumePasswordResetToken(tokenHash: string, now: Date): Promise<UserRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: {
            gt: now
          }
        },
        include: {
          user: true
        }
      });

      if (!token) {
        return null;
      }

      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: now }
      });

      return mapUser(token.user);
    });
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt
      }
    });
  }

  async consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<UserRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: {
            gt: now
          }
        },
        include: {
          user: true
        }
      });

      if (!token) {
        return null;
      }

      await tx.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: now }
      });

      const user = await tx.user.update({
        where: { id: token.userId },
        data: {
          emailVerifiedAt: token.user.emailVerifiedAt ?? now
        }
      });

      return mapUser(user);
    });
  }

  async listUsers(): Promise<UserSummary[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async updateUserRole(userId: string, role: Role): Promise<UserSummary | null> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } catch {
      return null;
    }
  }

  async createAuditLog(event: AuditEvent): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: event.action,
      success: event.success
    };

    if (event.userId) {
      data.userId = event.userId;
    }

    if (event.emailHash) {
      data.emailHash = event.emailHash;
    }

    if (event.ipHash) {
      data.ipHash = event.ipHash;
    }

    if (event.userAgent) {
      data.userAgent = event.userAgent.slice(0, 500);
    }

    const metadata = sanitizeMetadata(event.metadata);
    if (metadata) {
      data.metadata = metadata;
    }

    await this.prisma.auditLog.create({
      data
    });
  }

  async listAuditLogs(limit: number): Promise<AuditLogRecord[]> {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    }) as Promise<AuditLogRecord[]>;
  }
}
