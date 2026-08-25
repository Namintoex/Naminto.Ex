import "server-only";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "./security-events";

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

export type PinVerificationResult =
  | { ok: true }
  | { ok: false; reason: "not_set" | "locked" | "invalid" };

/**
 * Cœur de la vérification du PIN, indépendant de toute session HTTP —
 * reçoit directement l'utilisateur concerné. Utilisé à la fois par
 * `verifyPinAction` (Server Action, résout l'utilisateur depuis la
 * session) et par le Payment Orchestrator (Prompt 09, qui connaît déjà
 * l'expéditeur), pour ne pas dupliquer la logique de verrouillage.
 */
export async function verifyPinForUser(userId: string, pin: string): Promise<PinVerificationResult> {
  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("pin_credentials")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (!credentials) {
    return { ok: false, reason: "not_set" };
  }

  if (credentials.locked_until && new Date(credentials.locked_until) > new Date()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await verifyPinHash(pin, credentials.pin_hash);

  if (!valid) {
    const attempts = credentials.failed_attempts + 1;
    const locked = attempts >= PIN_MAX_ATTEMPTS;
    await admin
      .from("pin_credentials")
      .update({
        failed_attempts: locked ? 0 : attempts,
        locked_until: locked
          ? new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq("user_id", userId);

    await logSecurityEvent({
      userId,
      type: locked ? "pin_locked" : "pin_verification_failed",
      metadata: { attempts },
    });

    return { ok: false, reason: locked ? "locked" : "invalid" };
  }

  if (credentials.failed_attempts > 0) {
    await admin
      .from("pin_credentials")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("user_id", userId);
  }

  return { ok: true };
}
