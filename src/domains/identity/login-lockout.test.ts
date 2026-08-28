import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashLoginEmail,
  isLoginLocked,
  LOGIN_MAX_ATTEMPTS,
  recordLoginFailure,
  resetLoginAttempts,
} from "./login-lockout";

/**
 * Test d'intégration contre le vrai projet Supabase — anti-brute-force
 * sur la connexion (Prompt 28, ADR-056). `login_attempts` n'est jamais
 * liée à un compte réel : ce test n'a donc besoin d'aucun utilisateur de
 * test, seulement d'un hash d'e-mail jetable (supprimé par chaque test).
 */
describe("identity — login-lockout (intégration)", () => {
  const admin = createAdminClient();

  it("hashLoginEmail est déterministe et insensible à la casse/aux espaces", () => {
    expect(hashLoginEmail("Test@Example.com")).toBe(hashLoginEmail("  test@example.com  "));
    expect(hashLoginEmail("a@b.com")).not.toBe(hashLoginEmail("b@a.com"));
  });

  it("un burst de tentatives concurrentes atteint bien le verrouillage après LOGIN_MAX_ATTEMPTS échecs", async () => {
    const emailHash = hashLoginEmail(`vitest-login-race-${randomUUID()}@example.test`);

    expect(await isLoginLocked(emailHash)).toBe(false);

    const results = await Promise.all(
      Array.from({ length: LOGIN_MAX_ATTEMPTS }, () => recordLoginFailure(emailHash))
    );

    expect(results.some((r) => r.locked)).toBe(true);
    expect(await isLoginLocked(emailHash)).toBe(true);

    const { data: row } = await admin.from("login_attempts").select("*").eq("email_hash", emailHash).single();
    expect(row?.failed_attempts).toBe(0); // réinitialisé au moment du verrouillage
    expect(row?.locked_until).toBeTruthy();

    await admin.from("login_attempts").delete().eq("email_hash", emailHash);
  });

  it("resetLoginAttempts déverrouille et remet le compteur à zéro", async () => {
    const emailHash = hashLoginEmail(`vitest-login-reset-${randomUUID()}@example.test`);
    await recordLoginFailure(emailHash);
    await recordLoginFailure(emailHash);

    await resetLoginAttempts(emailHash);

    const { data: row } = await admin.from("login_attempts").select("*").eq("email_hash", emailHash).single();
    expect(row?.failed_attempts).toBe(0);
    expect(row?.locked_until).toBeNull();
    expect(await isLoginLocked(emailHash)).toBe(false);

    await admin.from("login_attempts").delete().eq("email_hash", emailHash);
  });
});
