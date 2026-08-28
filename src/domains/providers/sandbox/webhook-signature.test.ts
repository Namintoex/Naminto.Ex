import { describe, expect, it } from "vitest";
import { signSandboxWebhook, verifySandboxWebhookSignature } from "./webhook-signature";

describe("webhook-signature — signature HMAC-SHA256 des webhooks SANDBOX (Prompt 25)", () => {
  it("accepte une signature valide pour son payload exact", () => {
    const payload = JSON.stringify({ type: "transfer.confirmed" });
    const signature = signSandboxWebhook(payload);
    expect(verifySandboxWebhookSignature(payload, signature)).toBe(true);
  });

  it("rejette une signature absente", () => {
    const payload = JSON.stringify({ type: "transfer.confirmed" });
    expect(verifySandboxWebhookSignature(payload, null)).toBe(false);
  });

  it("rejette un en-tête de signature malformé (ni t= ni v1=)", () => {
    const payload = JSON.stringify({ type: "transfer.confirmed" });
    expect(verifySandboxWebhookSignature(payload, "not-a-valid-header")).toBe(false);
  });

  it("rejette une falsification du payload après signature (payload modifié, signature d'origine)", () => {
    const original = JSON.stringify({ type: "transfer.confirmed", amount: 1000 });
    const signature = signSandboxWebhook(original);
    const tampered = JSON.stringify({ type: "transfer.confirmed", amount: 999999 });
    expect(verifySandboxWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejette une falsification de la signature elle-même", () => {
    const payload = JSON.stringify({ type: "transfer.confirmed" });
    const signature = signSandboxWebhook(payload);
    const forged = signature.replace(/v1=.*/, "v1=" + "0".repeat(64));
    expect(verifySandboxWebhookSignature(payload, forged)).toBe(false);
  });

  it("rejette une signature dont le timestamp a été modifié sans recalcul (le timestamp fait partie du texte signé)", () => {
    const payload = JSON.stringify({ type: "transfer.confirmed" });
    const signature = signSandboxWebhook(payload, 1_700_000_000_000);
    const alteredTimestamp = signature.replace(/t=\d+/, "t=1700000000001");
    expect(verifySandboxWebhookSignature(payload, alteredTimestamp)).toBe(false);
  });
});
