import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { instrumentAdapter } from "./instrument";
import { createSandboxAdapter } from "./sandbox/create-sandbox-adapter";
import type { ProviderAdapter } from "./types";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex —
 * vérifie que instrumentAdapter journalise réellement dans
 * provider_call_logs (Prompt 27), sans jamais changer le comportement
 * de l'adapter enveloppé (résultat identique, erreur relancée telle quelle).
 */
describe("providers — instrumentAdapter (intégration)", () => {
  const admin = createAdminClient();
  const insertedIds: string[] = [];

  afterAll(async () => {
    if (insertedIds.length > 0) await admin.from("provider_call_logs").delete().in("id", insertedIds);
  });

  it("journalise un appel réussi sans changer le résultat renvoyé par l'adapter", async () => {
    const adapter = instrumentAdapter(
      createSandboxAdapter({ provider: "orange", capabilities: ["balance", "transfer"], startingBalance: 42_000 })
    );

    const result = await adapter.transfer({
      externalReference: "+2250700000099",
      amount: 1_000,
      currency: "XOF",
      idempotencyKey: `vitest-instrument-${randomUUID()}`,
      reference: "NEX-INSTRTEST",
    });
    expect(result.status).toBe("confirmed");

    // providerTransactionId est unique par appel (généré par le sandbox) — identifiant fiable pour retrouver EXACTEMENT ce log parmi ceux produits en parallèle par d'autres tests utilisant le même registre.
    const { data: log } = await admin
      .from("provider_call_logs")
      .select("*")
      .eq("provider_transaction_id", result.providerTransactionId)
      .eq("operation", "transfer")
      .maybeSingle();
    expect(log).toBeTruthy();
    if (log) insertedIds.push(log.id);
    expect(log?.provider).toBe("orange");
    expect(log?.success).toBe(true);
    expect(typeof log?.duration_ms).toBe("number");
  });

  it("relance l'erreur d'origine et journalise l'échec (jamais silencieux)", async () => {
    const failingAdapter: ProviderAdapter = {
      provider: "mtn",
      mode: "SANDBOX",
      async linkAccount() {
        throw new Error("mtn_unreachable");
      },
      async getBalance() {
        throw new Error("unused");
      },
      async transfer() {
        throw new Error("unused");
      },
      async receive() {
        throw new Error("unused");
      },
      async getTransactionStatus() {
        throw new Error("unused");
      },
      async cancelTransaction() {
        throw new Error("unused");
      },
      async refund() {
        throw new Error("unused");
      },
      async verifyAndParseWebhook() {
        throw new Error("unused");
      },
      async healthCheck() {
        throw new Error("unused");
      },
    };

    const adapter = instrumentAdapter(failingAdapter);
    await expect(adapter.linkAccount({ externalReference: "x" })).rejects.toThrow("mtn_unreachable");

    const { data: log } = await admin
      .from("provider_call_logs")
      .select("*")
      .eq("provider", "mtn")
      .eq("operation", "linkAccount")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(log).toBeTruthy();
    if (log) insertedIds.push(log.id);
    expect(log?.success).toBe(false);
    expect(log?.error_message).toBe("mtn_unreachable");
  });

  it("n'instrumente jamais verifyAndParseWebhook (pas un appel réseau, déjà audité par webhook_events)", async () => {
    const adapter = instrumentAdapter(createSandboxAdapter({ provider: "wave", capabilities: ["balance"] }));
    // Un appel direct à travers l'adapter instrumenté ne doit créer aucune ligne provider_call_logs pour cette opération.
    await adapter.verifyAndParseWebhook("{}", null);

    const { count } = await admin
      .from("provider_call_logs")
      .select("id", { count: "exact", head: true })
      .eq("provider", "wave")
      .eq("operation", "verifyAndParseWebhook");
    expect(count).toBe(0);
  });
});
