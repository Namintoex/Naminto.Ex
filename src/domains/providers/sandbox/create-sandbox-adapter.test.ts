import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createSandboxAdapter } from "./create-sandbox-adapter";
import { signSandboxWebhook } from "./webhook-signature";

function newAdapter(startingBalance = 10_000) {
  return createSandboxAdapter({
    provider: "orange",
    capabilities: ["balance", "transfer", "receive"],
    supportsRefund: true,
    startingBalance,
  });
}

describe("createSandboxAdapter", () => {
  it("linkAccount initialise le solde et renvoie les capacités configurées", async () => {
    const adapter = newAdapter();
    const link = await adapter.linkAccount({ externalReference: "+2250700000001" });
    expect(link.status).toBe("active");
    expect(link.capabilities).toEqual(["balance", "transfer", "receive"]);

    const balance = await adapter.getBalance("+2250700000001");
    expect(balance.amount).toBe(10_000);
    expect(balance.currency).toBe("XOF");
  });

  it("transfer débite le compte (argent qui sort vers Naminto.Ex)", async () => {
    const adapter = newAdapter(10_000);
    const result = await adapter.transfer({
      externalReference: "+2250700000002",
      amount: 3_000,
      currency: "XOF",
      idempotencyKey: randomUUID(),
      reference: "NEX-TEST",
    });
    expect(result.status).toBe("confirmed");

    const balance = await adapter.getBalance("+2250700000002");
    expect(balance.amount).toBe(7_000);
  });

  it("receive crédite le compte (argent qui entre depuis Naminto.Ex) — ne doit jamais débiter", async () => {
    const adapter = newAdapter(10_000);
    const result = await adapter.receive({
      externalReference: "+2250700000003",
      amount: 4_000,
      currency: "XOF",
      idempotencyKey: randomUUID(),
      reference: "NEX-TEST",
    });
    expect(result.status).toBe("confirmed");

    const balance = await adapter.getBalance("+2250700000003");
    expect(balance.amount).toBe(14_000);
  });

  it("transfer et receive sont chacun idempotents par clé, indépendamment l'un de l'autre", async () => {
    const adapter = newAdapter(10_000);
    const key = randomUUID();
    const params = {
      externalReference: "+2250700000004",
      amount: 1_000,
      currency: "XOF",
      idempotencyKey: key,
      reference: "NEX-TEST",
    };

    const first = await adapter.transfer(params);
    const replay = await adapter.transfer(params);
    expect(replay.providerTransactionId).toBe(first.providerTransactionId);

    const balance = await adapter.getBalance("+2250700000004");
    expect(balance.amount).toBe(9_000); // un seul débit malgré les 2 appels
  });

  it("transfer échoue proprement si le solde est insuffisant, sans débiter", async () => {
    const adapter = newAdapter(1_000);
    const result = await adapter.transfer({
      externalReference: "+2250700000005",
      amount: 5_000,
      currency: "XOF",
      idempotencyKey: randomUUID(),
      reference: "NEX-TEST",
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("INSUFFICIENT_FUNDS");

    const balance = await adapter.getBalance("+2250700000005");
    expect(balance.amount).toBe(1_000);
  });

  it("refund respecte supportsRefund", async () => {
    const withRefund = createSandboxAdapter({
      provider: "orange",
      capabilities: ["balance", "transfer"],
      supportsRefund: true,
    });
    const withoutRefund = createSandboxAdapter({
      provider: "moov",
      capabilities: ["balance", "transfer"],
      supportsRefund: false,
    });

    const tx = await withRefund.transfer({
      externalReference: "+2250700000006",
      amount: 500,
      currency: "XOF",
      idempotencyKey: randomUUID(),
      reference: "NEX-TEST",
    });

    expect(await withRefund.refund(tx.providerTransactionId)).toMatchObject({
      supported: true,
      success: true,
    });
    expect(await withoutRefund.refund("whatever")).toEqual({ supported: false });
  });

  it("healthCheck renvoie toujours operational en mode SANDBOX", async () => {
    const adapter = newAdapter();
    const health = await adapter.healthCheck();
    expect(health.status).toBe("operational");
  });

  it("expose mode: SANDBOX — jamais REAL sans intégration effective", async () => {
    const adapter = newAdapter();
    expect(adapter.mode).toBe("SANDBOX");
  });

  describe("verifyAndParseWebhook (Prompt 25)", () => {
    it("accepte un payload correctement signé et bien formé, et en extrait les champs", async () => {
      const adapter = newAdapter();
      const payload = JSON.stringify({
        type: "transfer.confirmed",
        event_id: "evt_1",
        occurred_at: new Date().toISOString(),
        provider_transaction_id: "orange_abc123",
        status: "confirmed",
      });
      const result = await adapter.verifyAndParseWebhook(payload, signSandboxWebhook(payload));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.event).toMatchObject({
          type: "transfer.confirmed",
          eventId: "evt_1",
          providerTransactionId: "orange_abc123",
          status: "confirmed",
        });
      }
    });

    it("rejette une signature absente (authentification)", async () => {
      const adapter = newAdapter();
      const payload = JSON.stringify({ type: "x", event_id: "evt_2", occurred_at: new Date().toISOString() });
      const result = await adapter.verifyAndParseWebhook(payload, null);
      expect(result).toEqual({ valid: false, reason: "missing_signature" });
    });

    it("rejette une signature invalide (protection falsification)", async () => {
      const adapter = newAdapter();
      const payload = JSON.stringify({ type: "x", event_id: "evt_3", occurred_at: new Date().toISOString() });
      const result = await adapter.verifyAndParseWebhook(payload, "t=1,v1=" + "0".repeat(64));
      expect(result).toEqual({ valid: false, reason: "invalid_signature" });
    });

    it("rejette un JSON malformé correctement signé (protection payload invalide)", async () => {
      const adapter = newAdapter();
      const payload = "not-json";
      const result = await adapter.verifyAndParseWebhook(payload, signSandboxWebhook(payload));
      expect(result).toEqual({ valid: false, reason: "invalid_payload" });
    });

    it("rejette un payload bien formé JSON mais incomplet (champs requis absents)", async () => {
      const adapter = newAdapter();
      const payload = JSON.stringify({ type: "x" }); // event_id/occurred_at manquants
      const result = await adapter.verifyAndParseWebhook(payload, signSandboxWebhook(payload));
      expect(result).toEqual({ valid: false, reason: "invalid_payload" });
    });
  });
});
