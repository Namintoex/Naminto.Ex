import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateFee } from "./calculate-fee";
import { NoMatchingFeeRuleError } from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie la lecture
 * de fee_rules (y compris la règle de repli 3,5 % XOF insérée par
 * supabase/migrations/0006_fee_rules.sql) et la configurabilité réelle
 * via des règles de test temporaires, nettoyées après coup.
 */
describe("Fee Engine — calculateFee (intégration)", () => {
  const admin = createAdminClient();
  const createdRuleIds: string[] = [];

  afterAll(async () => {
    if (createdRuleIds.length > 0) {
      await admin.from("fee_rules").delete().in("id", createdRuleIds);
    }
  });

  it.each([
    [1_000, 35],
    [5_000, 175],
    [10_000, 350],
    [250_000, 8_750],
  ])("applique la règle de repli 3,5%% XOF pour %i FCFA → frais %i", async (amount, expectedFee) => {
    const result = await calculateFee({ amount, currency: "XOF" });
    expect(result.fee).toBeCloseTo(expectedFee);
    expect(result.feePayer).toBe("sender");
    expect(result.senderDebit).toBeCloseTo(amount + expectedFee);
    expect(result.recipientCredit).toBe(amount);
  });

  it("feePayerOverride = recipient : le montant reçu est réduit, pas le débit expéditeur", async () => {
    const result = await calculateFee({ amount: 5_000, currency: "XOF", feePayerOverride: "recipient" });
    expect(result.feePayer).toBe("recipient");
    expect(result.senderDebit).toBe(5_000);
    expect(result.recipientCredit).toBeCloseTo(5_000 - result.fee);
  });

  it("une règle plus spécifique (fournisseur) l'emporte sur la règle générique", async () => {
    const { data: rule, error } = await admin
      .from("fee_rules")
      .insert({
        currency: "XOF",
        provider: "wave",
        rate_percent: 0.02,
        fee_payer: "sender",
      })
      .select("id")
      .single();
    if (error || !rule) throw new Error(`Setup de la règle de test échoué: ${error?.message}`);
    createdRuleIds.push(rule.id);

    const waveResult = await calculateFee({ amount: 10_000, currency: "XOF", provider: "wave" });
    expect(waveResult.ruleId).toBe(rule.id);
    expect(waveResult.fee).toBeCloseTo(200); // 2 % au lieu de 3,5 %

    const orangeResult = await calculateFee({ amount: 10_000, currency: "XOF", provider: "orange" });
    expect(orangeResult.ruleId).not.toBe(rule.id);
    expect(orangeResult.fee).toBeCloseTo(350); // règle de repli 3,5 %
  });

  it("respecte une plage de montant configurée", async () => {
    const { data: rule, error } = await admin
      .from("fee_rules")
      .insert({
        currency: "XOF",
        min_amount: 100_000,
        max_amount: 500_000,
        rate_percent: 0.01,
        fee_payer: "sender",
      })
      .select("id")
      .single();
    if (error || !rule) throw new Error(`Setup de la règle de test échoué: ${error?.message}`);
    createdRuleIds.push(rule.id);

    const inRange = await calculateFee({ amount: 200_000, currency: "XOF" });
    expect(inRange.ruleId).toBe(rule.id);
    expect(inRange.fee).toBeCloseTo(2_000); // 1 % au lieu de 3,5 %

    const outOfRange = await calculateFee({ amount: 50_000, currency: "XOF" });
    expect(outOfRange.ruleId).not.toBe(rule.id);
  });

  it("lève NoMatchingFeeRuleError si aucune règle active ne correspond (devise inconnue)", async () => {
    await expect(
      calculateFee({ amount: 1_000, currency: `TEST_${randomUUID().slice(0, 6)}` })
    ).rejects.toBeInstanceOf(NoMatchingFeeRuleError);
  });
});
