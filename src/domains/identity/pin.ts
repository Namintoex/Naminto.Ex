import "server-only";
import bcrypt from "bcryptjs";

const PIN_PATTERN = /^\d{6}$/;
const HASH_ROUNDS = 12;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, HASH_ROUNDS);
}

export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
