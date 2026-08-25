import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeQr, verifyQr } from "./sign";
import { resolveBeneficiary, resolvePrefilledPayment } from "./resolve";
import { BENEFICIARY_QR_TTL_MS } from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase — couvre le pipeline
 * complet decode → validate → resolve pour BENEFICIARY et
 * PREFILLED_PAYMENT (Prompt 15). REQUEST/PAYMENT_REQUEST délèguent leur
 * resolve à `getMoneyRequestByToken` (Prompt 14, déjà testé) — non
 * dupliqué ici.
 */
describe("QR Engine — resolve (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const namintoId = `vitest_qr_${randomUUID().slice(0, 8)}`;
  const testEmail = `vitest-qr-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: namintoId, legal_name: "Vitest QR" },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("decode → validate → resolve un QR BENEFICIARY authentique vers l'utilisateur réel", async () => {
    const now = Date.now();
    const encoded = encodeQr({ v: 1, type: "BENEFICIARY", iat: now, exp: now + BENEFICIARY_QR_TTL_MS, namintoId });

    const decoded = verifyQr(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok || decoded.payload.type !== "BENEFICIARY") throw new Error("unreachable");

    const recipient = await resolveBeneficiary(decoded.payload);
    expect(recipient?.userId).toBe(userId);
    expect(recipient?.namintoId).toBe(namintoId);
  });

  it("resolve renvoie null pour un BENEFICIARY dont l'identifiant n'existe plus", async () => {
    const now = Date.now();
    const encoded = encodeQr({
      v: 1,
      type: "BENEFICIARY",
      iat: now,
      exp: now + BENEFICIARY_QR_TTL_MS,
      namintoId: `unknown_${randomUUID().slice(0, 8)}`,
    });
    const decoded = verifyQr(encoded);
    if (!decoded.ok || decoded.payload.type !== "BENEFICIARY") throw new Error("unreachable");

    const recipient = await resolveBeneficiary(decoded.payload);
    expect(recipient).toBeNull();
  });

  it("decode → validate → resolve un QR PREFILLED_PAYMENT authentique vers l'utilisateur réel", async () => {
    const now = Date.now();
    const encoded = encodeQr({
      v: 1,
      type: "PREFILLED_PAYMENT",
      iat: now,
      exp: now + 60_000,
      recipientUserId: userId,
      recipientNamintoId: namintoId,
      amount: 1_500,
      currency: "XOF",
      note: "Test QR Engine",
    });

    const decoded = verifyQr(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok || decoded.payload.type !== "PREFILLED_PAYMENT") throw new Error("unreachable");

    const recipient = await resolvePrefilledPayment(decoded.payload);
    expect(recipient?.userId).toBe(userId);
  });
});
