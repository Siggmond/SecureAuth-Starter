import argon2 from "argon2";

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 3,
  parallelism: 1
};

function applyPepper(password: string, pepper: string): string {
  return pepper.length > 0 ? `${password}${pepper}` : password;
}

export function hashPassword(password: string, pepper: string): Promise<string> {
  return argon2.hash(applyPepper(password, pepper), ARGON2_OPTIONS);
}

export function verifyPassword(hash: string, password: string, pepper: string): Promise<boolean> {
  return argon2.verify(hash, applyPepper(password, pepper), ARGON2_OPTIONS);
}
