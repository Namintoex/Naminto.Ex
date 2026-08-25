import { describe, expect, it } from "vitest";
import { encodeQr, verifyQr } from "./sign";
import type { BeneficiaryQrPayload, PaymentRequestQrPayload, PrefilledPaymentQrPayload, RequestQrPayload } from "./types";

function beneficiaryPayload(overrides: Partial<BeneficiaryQrPayload> = {}): BeneficiaryQrPayload {
  const now = Date.now();
  return {
    v: 1,
    type: "BENEFICIARY",
    iat: now,
    exp: now + 60_000,
    namintoId: "kouassi_demo",
    ...overrides,
  };
}

/**
 * Test unitaire, sans base de données — couvre les étapes « decode →
 * validate » du QR Engine (Prompt 15) : un QR authentiquement signé par
 * Naminto.Ex, jamais un simple format bien formé.
 */
describe("QR Engine — encodeQr / verifyQr (pur)", () => {
  it("un QR correctement signé se décode avec le payload d'origine", () => {
    const payload = beneficiaryPayload();
    const encoded = encodeQr(payload);

    const result = verifyQr(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual(payload);
    }
  });

  it("rejette un payload altéré après signature (falsification)", () => {
    const encoded = encodeQr(beneficiaryPayload({ namintoId: "victime" }));
    const [data, signature] = encoded.split(".");
    const tamperedData = Buffer.from(JSON.stringify(beneficiaryPayload({ namintoId: "attaquant" })), "utf8").toString(
      "base64url"
    );
    const tampered = `${tamperedData}.${signature}`;

    const result = verifyQr(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
    expect(data).not.toBe(tamperedData);
  });

  it("rejette une signature incorrecte de même longueur", () => {
    const encoded = encodeQr(beneficiaryPayload());
    const [data] = encoded.split(".");
    const fakeSignature = Buffer.alloc(32, 1).toString("base64url");
    const result = verifyQr(`${data}.${fakeSignature}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_signature");
  });

  it("rejette un QR expiré même correctement signé", () => {
    const encoded = encodeQr(beneficiaryPayload({ exp: Date.now() - 1_000 }));
    const result = verifyQr(encoded);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejette une chaîne mal formée (pas de séparateur)", () => {
    const result = verifyQr("not-a-valid-qr-token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });

  it("rejette un payload dont le type est inconnu, même correctement signé", () => {
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload délibérément invalide pour ce test
    const encoded = encodeQr({ v: 1, type: "UNKNOWN", iat: now, exp: now + 60_000 } as any);
    const result = verifyQr(encoded);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_payload");
  });

  it("rejette un payload BENEFICIARY sans namintoId, même correctement signé", () => {
    const now = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload délibérément invalide pour ce test
    const encoded = encodeQr({ v: 1, type: "BENEFICIARY", iat: now, exp: now + 60_000 } as any);
    const result = verifyQr(encoded);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_payload");
  });

  it("encode/verify round-trip pour PAYMENT_REQUEST", () => {
    const now = Date.now();
    const payload: PaymentRequestQrPayload = {
      v: 1,
      type: "PAYMENT_REQUEST",
      iat: now,
      exp: now + 60_000,
      token: "t",
      amount: 100,
      currency: "XOF",
      requesterNamintoId: "x",
    };
    const result = verifyQr(encodeQr(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toEqual(payload);
  });

  it("encode/verify round-trip pour PREFILLED_PAYMENT", () => {
    const now = Date.now();
    const payload: PrefilledPaymentQrPayload = {
      v: 1,
      type: "PREFILLED_PAYMENT",
      iat: now,
      exp: now + 60_000,
      recipientUserId: "u",
      recipientNamintoId: "x",
      amount: 100,
      currency: "XOF",
      note: null,
    };
    const result = verifyQr(encodeQr(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toEqual(payload);
  });

  it("encode/verify round-trip pour REQUEST", () => {
    const now = Date.now();
    const payload: RequestQrPayload = { v: 1, type: "REQUEST", iat: now, exp: now + 60_000, token: "t" };
    const result = verifyQr(encodeQr(payload));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toEqual(payload);
  });
});
