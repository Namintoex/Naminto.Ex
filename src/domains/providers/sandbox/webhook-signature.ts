import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signature HMAC-SHA256 des webhooks SANDBOX (Prompt 25) — même schéma
 * pour les 5 fournisseurs simulés puisque nous jouons ici à la fois le
 * rôle de l'émetteur et du récepteur. Un fournisseur REAL aura son
 * propre schéma documenté par lui, à implémenter dans son propre
 * adapter le jour de sa connexion réelle — TODO_DECISION.
 *
 * Format d'en-tête : `t=<timestamp_ms>,v1=<hmac hex>`, signature calculée
 * sur `${timestamp}.${payload}` (même principe que Stripe) — le
 * timestamp fait partie du texte signé pour empêcher un attaquant de le
 * modifier sans invalider la signature.
 */
function getSigningSecret(): string {
  const value = process.env.WEBHOOK_SIGNING_SECRET;
  if (!value) {
    throw new Error(
      "Variable d'environnement manquante: WEBHOOK_SIGNING_SECRET. Voir .env.example et renseigner .env.local."
    );
  }
  return value;
}

function computeSignature(timestamp: string, payload: string): string {
  return createHmac("sha256", getSigningSecret()).update(`${timestamp}.${payload}`).digest("hex");
}

export function signSandboxWebhook(payload: string, timestamp: number = Date.now()): string {
  return `t=${timestamp},v1=${computeSignature(String(timestamp), payload)}`;
}

function parseSignatureHeader(header: string): { timestamp: string; signature: string } | null {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2)
  );
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

export function verifySandboxWebhookSignature(payload: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const expected = computeSignature(parsed.timestamp, payload);
  const providedBuf = Buffer.from(parsed.signature, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
