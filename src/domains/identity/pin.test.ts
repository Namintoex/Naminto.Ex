import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, PIN_MAX_ATTEMPTS, verifyPinForUser } from "./pin";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie
 * spécifiquement l'incrémentation atomique corrigée au Prompt 28
 * (ADR-056) : un burst de tentatives réellement concurrentes doit
 * toujours atteindre le verrouillage après PIN_MAX_ATTEMPTS échecs,
 * jamais moins (l'ancien code, lecture-puis-écriture non atomique,
 * laissait un burst concurrent réinitialiser silencieusement le
 * compteur en lisant tous la même valeur avant l'écriture).
 */
describe("identity — verifyPinForUser (concurrence, intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const email = `vitest-pin-race-${randomUUID()}@example.test`;
  const realPin = "246810";

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_pin_race_${randomUUID().slice(0, 8)}`, legal_name: "Vitest PIN Race" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;
    await admin.from("pin_credentials").insert({ user_id: userId, pin_hash: await hashPin(realPin) });
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it(`un burst de ${PIN_MAX_ATTEMPTS} tentatives concurrentes avec un mauvais PIN atteint bien le verrouillage`, async () => {
    const attempts = await Promise.all(
      Array.from({ length: PIN_MAX_ATTEMPTS }, () => verifyPinForUser(userId, "000000"))
    );

    expect(attempts.every((a) => a.ok === false)).toBe(true);
    const lockedCount = attempts.filter((a) => !a.ok && a.reason === "locked").length;
    // Sous course parfaite, un seul appel observe le franchissement exact
    // du seuil et renvoie "locked" — les autres ont pu être comptés avant
    // ou après selon l'ordre de sérialisation, mais au moins un doit
    // effectivement déclencher le verrouillage.
    expect(lockedCount).toBeGreaterThanOrEqual(1);

    const { data: credentials } = await admin
      .from("pin_credentials")
      .select("failed_attempts, locked_until")
      .eq("user_id", userId)
      .single();
    expect(credentials?.locked_until).toBeTruthy();
    expect(new Date(credentials!.locked_until!).getTime()).toBeGreaterThan(Date.now());

    // Verrouillé : même le bon PIN est refusé tant que locked_until n'est pas passé.
    const result = await verifyPinForUser(userId, realPin);
    expect(result).toEqual({ ok: false, reason: "locked" });
  });
});
