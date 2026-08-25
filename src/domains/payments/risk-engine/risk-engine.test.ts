import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "../transactions";
import { assessRisk, AMOUNT_HIGH_THRESHOLD_XOF } from "./assess-risk";
import { fetchRiskContext } from "./usage-queries";
import type { RiskCheckInput } from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie que
 * `fetchRiskContext`/`assessRisk` (Prompt 17) lisent réellement
 * l'historique, l'appareil et le bénéficiaire depuis la base, pas des
 * valeurs approximées.
 */
describe("Risk Engine — assessRisk / fetchRiskContext (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-risk-${randomUUID()}@example.test`;
  const createdTransactionIds: string[] = [];

  async function settledTransaction(params: {
    amount: number;
    destinationExternalReference?: string;
  }) {
    const tx = await createTransaction({
      senderUserId: userId,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      destinationExternalReference: params.destinationExternalReference ?? null,
      provider: null,
      amount: params.amount,
      currency: "XOF",
      idempotencyKey: `vitest-risk-${randomUUID()}`,
    });
    createdTransactionIds.push(tx.id);
    for (const status of [
      "validating",
      "authentication_required",
      "authenticated",
      "processing",
      "provider_confirmed",
      "settled",
    ] as const) {
      await transitionTransaction(tx.id, status);
    }
    return tx;
  }

  function baseInput(overrides: Partial<RiskCheckInput> = {}): RiskCheckInput {
    return {
      senderUserId: userId,
      amount: 5_000,
      currency: "XOF",
      destinationType: "external",
      recipientUserId: null,
      destinationExternalReference: "+225070000099",
      deviceFingerprint: null,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_risk_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Risk Engine" },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (createdTransactionIds.length > 0) {
      await admin.from("transactions").delete().in("id", createdTransactionIds);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("compte sans historique : signal history MEDIUM, décision globale non bloquante pour un petit montant", async () => {
    const decision = await assessRisk(baseInput({ destinationExternalReference: `+225${randomUUID().slice(0, 8)}` }));
    expect(decision.level).not.toBe("HIGH");
    const history = decision.reasons.find((r) => r.code === "history");
    expect(history?.level).toBe("MEDIUM");
  });

  it("bénéficiaire déjà réglé auparavant : signal beneficiary LOW, jamais présenté comme nouveau", async () => {
    const ref = `+225${randomUUID().slice(0, 8)}`;
    await settledTransaction({ amount: 1_000, destinationExternalReference: ref });

    const context = await fetchRiskContext(baseInput({ destinationExternalReference: ref }));
    expect(context.isNewBeneficiary).toBe(false);
    expect(context.historyCount).toBeGreaterThanOrEqual(1);
  });

  it("appareil non approuvé : signal device MEDIUM", async () => {
    const fingerprint = `vitest-device-${randomUUID()}`;
    await admin.from("devices").insert({ user_id: userId, device_fingerprint: fingerprint, status: "untrusted" });

    const decision = await assessRisk(baseInput({ deviceFingerprint: fingerprint }));
    const device = decision.reasons.find((r) => r.code === "device");
    expect(device?.level).toBe("MEDIUM");
    expect(device?.details?.deviceStatus).toBe("untrusted");
  });

  it("appareil non transmis : signal device LOW, jamais pénalisé pour une absence d'information", async () => {
    const decision = await assessRisk(baseInput({ deviceFingerprint: null }));
    const device = decision.reasons.find((r) => r.code === "device");
    expect(device?.level).toBe("LOW");
  });

  it("montant au-delà du seuil HIGH : décision globale HIGH avec la raison correspondante", async () => {
    const decision = await assessRisk(baseInput({ amount: AMOUNT_HIGH_THRESHOLD_XOF + 1 }));
    expect(decision.level).toBe("HIGH");
    const amountSignal = decision.reasons.find((r) => r.code === "amount");
    expect(amountSignal?.level).toBe("HIGH");
  });

  it("chaque décision porte des raisons structurées pour les 7 dimensions exigées", async () => {
    const decision = await assessRisk(baseInput());
    const codes = decision.reasons.map((r) => r.code).sort();
    expect(codes).toEqual(["amount", "beneficiary", "behavior", "context", "device", "frequency", "history"].sort());
    for (const r of decision.reasons) {
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});
