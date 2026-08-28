import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;

/**
 * Jamais l'adresse en clair, jamais liée à un compte réel (Prompt 28,
 * ADR-056) — couvre aussi les tentatives contre une adresse inexistante,
 * pas seulement les comptes réels (`security_events.user_id` est
 * `not null`, un compte inexistant n'a donc de toute façon aucune ligne
 * à journaliser là-bas).
 */
export function hashLoginEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function isLoginLocked(emailHash: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("login_attempts").select("locked_until").eq("email_hash", emailHash).maybeSingle();
  return Boolean(data?.locked_until && new Date(data.locked_until) > new Date());
}

/**
 * Incrémentation atomique via RPC (migration 0020) — un burst de
 * tentatives concurrentes contre le même e-mail ne peut plus toutes
 * lire la même valeur avant l'écriture et empêcher le verrouillage de
 * se déclencher (même correctif que verifyPinForUser, pin.ts).
 */
export async function recordLoginFailure(emailHash: string): Promise<{ locked: boolean }> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("record_login_failure", {
    p_email_hash: emailHash,
    p_max_attempts: LOGIN_MAX_ATTEMPTS,
    p_lockout_minutes: LOGIN_LOCKOUT_MINUTES,
  });
  return { locked: data?.[0]?.locked ?? false };
}

export async function resetLoginAttempts(emailHash: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("login_attempts").update({ failed_attempts: 0, locked_until: null }).eq("email_hash", emailHash);
}
