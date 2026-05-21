import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "Password must be at least 12 characters.")
  .max(PASSWORD_MAX_LENGTH, "Password must be at most 128 characters.")
  .regex(/[a-z]/, "Password must contain a lowercase letter.")
  .regex(/[A-Z]/, "Password must contain an uppercase letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const registerSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80)
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH)
});

export const emailSchema = z.object({
  email: normalizedEmailSchema
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(512),
  password: passwordSchema
});

export const emailVerificationConfirmSchema = z.object({
  token: z.string().min(32).max(512)
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN"])
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type EmailVerificationConfirmInput = z.infer<typeof emailVerificationConfirmSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
