import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "../transactions";
import { checkLimits } from "./check-limits";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie que
 * l'absence de règle n'est jamais un refus, et que des règles de test
 * temporaires sont réellement appliquées à partir de l'usage réel dans
 * `transactions`.
 */
describe("Limit Engine — checkLimits (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-limits-${randomUUID()}@example.test`;
  const createdRuleIds: string[] = [];
  const createdTransactionIds: string[] = [];

  async function settledTransaction(amount: number) {
    const tx = await createTransaction({
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: null,
      amount,
      currency: "XOF",
      idempotencyKey: `vitest-limits-${randomUUID()}`,
    });
    createdTransactionIds.push(tx.id);
    for (const status of ["validating", "authentication_required", "authenticated", "processing", "provider_confirmed", "settled"] as const) {
      await transitionTransaction(tx.id, status);
    }
    return tx;
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_limits_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Limit Engine Test",
      },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterEach(async () => {
    // Chaque test repart d'un usage propre : les règles ET les
    // transactions créées dans un test ne doivent pas fausser le
    // suivant (ex. le test frequency_count compte les transactions du
    // test précédent sinon).
    if (createdRuleIds.length > 0) {
      await admin.from("limit_rules").delete().in("id", createdRuleIds);
      createdRuleIds.length = 0;
    }
    if (createdTransactionIds.length > 0) {
      await admin.from("transactions").delete().in("id", createdTransactionIds);
      createdTransactionIds.length = 0;
    }
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("aucune règle configurée ⇒ toujours autorisé (absence de contrainte, jamais un refus)", async () => {
    const decision = await checkLimits({ userId, amount: 10_000_000, currency: "XOF" });
    expect(decision.allowed).toBe(true);
    expect(decision.violations).toHaveLength(0);
  });

  it("per_transaction_amount : refuse un montant supérieur à la limite, avec une décision explicable", async () => {
    const { data: rule } = await admin
      .from("limit_rules")
      .insert({ limit_type: "per_transaction_amount", max_amount: 50_000, currency: "XOF" })
      .select("id")
      .single();
    createdRuleIds.push(rule!.id);

    const withinLimit = await checkLimits({ userId, amount: 50_000, currency: "XOF" });
    expect(withinLimit.allowed).toBe(true);

    const overLimit = await checkLimits({ userId, amount: 50_001, currency: "XOF" });
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.violations).toHaveLength(1);
    expect(overLimit.violations[0]).toMatchObject({
      limitType: "per_transaction_amount",
      limitValue: 50_000,
      ruleId: rule!.id,
    });
    expect(overLimit.violations[0].message).toContain("50000");
  });

  it("daily_amount : prend en compte l'usage réel déjà réglé aujourd'hui", async () => {
    const { data: rule } = await admin
      .from("limit_rules")
      .insert({ limit_type: "daily_amount", max_amount: 100_000, currency: "XOF" })
      .select("id")
      .single();
    createdRuleIds.push(rule!.id);

    await settledTransaction(70_000);

    const stillOk = await checkLimits({ userId, amount: 20_000, currency: "XOF" });
    expect(stillOk.allowed).toBe(true);

    const wouldExceed = await checkLimits({ userId, amount: 40_000, currency: "XOF" });
    expect(wouldExceed.allowed).toBe(false);
    expect(wouldExceed.violations[0].limitType).toBe("daily_amount");
    expect(wouldExceed.violations[0].projectedUsage).toBe(110_000);
  });

  it("frequency_count : refuse au-delà du nombre d'opérations autorisées sur la fenêtre", async () => {
    const { data: rule } = await admin
      .from("limit_rules")
      .insert({ limit_type: "frequency_count", max_count: 2, period_hours: 24 })
      .select("id")
      .single();
    createdRuleIds.push(rule!.id);

    await settledTransaction(1_000);
    const afterOne = await checkLimits({ userId, amount: 1_000, currency: "XOF" });
    expect(afterOne.allowed).toBe(true); // 1 existante + celle-ci = 2, à la limite

    await settledTransaction(1_000);
    const afterTwo = await checkLimits({ userId, amount: 1_000, currency: "XOF" });
    expect(afterTwo.allowed).toBe(false); // 2 existantes + celle-ci = 3 > 2
    expect(afterTwo.violations[0].limitType).toBe("frequency_count");
  });

  it("une règle plus spécifique (statut KYC) l'emporte sur la règle générique", async () => {
    const generic = await admin
      .from("limit_rules")
      .insert({ limit_type: "per_transaction_amount", max_amount: 50_000, currency: "XOF" })
      .select("id")
      .single();
    createdRuleIds.push(generic.data!.id);

    const verifiedRule = await admin
      .from("limit_rules")
      .insert({
        limit_type: "per_transaction_amount",
        max_amount: 1_000_000,
        currency: "XOF",
        kyc_status: "verified",
      })
      .select("id")
      .single();
    createdRuleIds.push(verifiedRule.data!.id);

    const unverifiedDecision = await checkLimits({
      userId,
      amount: 200_000,
      currency: "XOF",
      kycStatus: "unverified",
    });
    expect(unverifiedDecision.allowed).toBe(false);
    expect(unverifiedDecision.violations[0].ruleId).toBe(generic.data!.id);

    const verifiedDecision = await checkLimits({
      userId,
      amount: 200_000,
      currency: "XOF",
      kycStatus: "verified",
    });
    expect(verifiedDecision.allowed).toBe(true);
  });
});
