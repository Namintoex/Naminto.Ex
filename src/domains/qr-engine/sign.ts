import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { QrPayload, QrVerifyResult } from "./types";

function getSigningSecret(): string {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value) {
    throw new Error(
      "Variable d'environnement manquante: QR_SIGNING_SECRET. Voir .env.example et renseigner .env.local."
    );
  }
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", getSigningSecret()).update(data).digest("base64url");
}

/**
 * Étape « encode » (émission) — jamais confondue avec « decode »
 * (lecture). Format compact : `<payload base64url>.<signature base64url>`,
 * intégrable tel quel dans une URL (`/qr/<encoded>`), donc dans un QR
 * code, sans encodage supplémentaire.
 */
export function encodeQr(payload: QrPayload): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${data}.${sign(data)}`;
}

function isPlausiblePayload(value: unknown): value is QrPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.v !== 1) return false;
  if (typeof record.iat !== "number" || typeof record.exp !== "number") return false;

  switch (record.type) {
    case "BENEFICIARY":
      return typeof record.namintoId === "string" && record.namintoId.length > 0;
    case "REQUEST":
      return typeof record.token === "string" && record.token.length > 0;
    case "PAYMENT_REQUEST":
      return (
        typeof record.token === "string" &&
        typeof record.amount === "number" &&
        typeof record.currency === "string" &&
        typeof record.requesterNamintoId === "string"
      );
    case "PREFILLED_PAYMENT":
      return (
        typeof record.recipientUserId === "string" &&
        typeof record.recipientNamintoId === "string" &&
        typeof record.amount === "number" &&
        record.amount > 0 &&
        typeof record.currency === "string"
      );
    default:
      return false;
  }
}

/**
 * Étape « decode → validate » du cycle obligatoire (Prompt 15) :
 * décode le format compact, vérifie la signature (temps constant,
 * `timingSafeEqual`), la forme du payload selon son type, puis
 * l'expiration. Ne dit jamais si l'objet référencé (utilisateur,
 * demande…) existe encore réellement — c'est le rôle de « resolve »
 * (resolve.ts), volontairement séparé.
 */
export function verifyQr(raw: string): QrVerifyResult {
  const parts = raw.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [data, signature] = parts;
  if (!data || !signature) return { ok: false, reason: "malformed" };

  const expected = sign(data);
  const signatureBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return { ok: false, reason: "invalid_signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!isPlausiblePayload(parsed)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (parsed.exp < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload: parsed };
}
