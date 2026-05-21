import { randomUUID } from "node:crypto";
import type { UserRecord } from "./auth-repository";

export type DevEmail = {
  id: string;
  to: string;
  type: "password-reset" | "email-verification";
  subject: string;
  createdAt: string;
  token: string;
  url: string;
};

export class DevEmailService {
  private readonly messages: DevEmail[] = [];

  constructor(private readonly webOrigin: string) {}

  async sendPasswordReset(user: UserRecord, token: string): Promise<void> {
    this.messages.unshift({
      id: randomUUID(),
      to: user.email,
      type: "password-reset",
      subject: "Reset your SecureAuth Starter password",
      createdAt: new Date().toISOString(),
      token,
      url: `${this.webOrigin}/reset-password?token=${encodeURIComponent(token)}`
    });
  }

  async sendEmailVerification(user: UserRecord, token: string): Promise<void> {
    this.messages.unshift({
      id: randomUUID(),
      to: user.email,
      type: "email-verification",
      subject: "Verify your SecureAuth Starter email",
      createdAt: new Date().toISOString(),
      token,
      url: `${this.webOrigin}/verify-email?token=${encodeURIComponent(token)}`
    });
  }

  list(): DevEmail[] {
    return this.messages.slice(0, 50);
  }
}
