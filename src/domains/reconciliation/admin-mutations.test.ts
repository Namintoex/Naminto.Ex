import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction } from "@/domains/payments/transactions";
import { adminUpdateAnomalyStatus } from "./admin-mutations";

describe("reconciliation — adminUpdateAnomalyStatus (intégration)", () => {
  const admin = createAdminClient();
  let transactionId: string;
  let anomalyId: string;

  afterAll(async () => {
    if (anomalyId) await admin.from("reconciliation_anomalies").delete().eq("id", anomalyId);
    if (transactionId) await admin.from("transactions").delete().eq("id", transactionId);
  });

  it("refuse une transition invalide, applique une transition valide, puis refuse un id inconnu", async () => {
    const tx = await createTransaction({
      senderUserId: null,
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: null,
      amount: 1_000,
      idempotencyKey: `vitest-reco-mut-${randomUUID()}`,
    });
    transactionId = tx.id;

    const { data: anomaly, error } = await admin
      .from("reconciliation_anomalies")
      .insert({ transaction_id: transactionId, type: "missing", details: {} })
      .select("id")
      .single();
    if (error || !anomaly) throw new Error(`Setup échoué: ${error?.message}`);
    anomalyId = anomaly.id;

    const invalid = await adminUpdateAnomalyStatus(anomalyId, "resolved");
    expect(invalid).toEqual({ ok: false, error: "admin.reconciliation.error.invalidTransition" });

    const valid = await adminUpdateAnomalyStatus(anomalyId, "investigating", "en cours d'analyse");
    expect(valid).toEqual({ ok: true });

    const { data: row } = await admin
      .from("reconciliation_anomalies")
      .select("status, note")
      .eq("id", anomalyId)
      .single();
    expect(row?.status).toBe("investigating");
    expect(row?.note).toBe("en cours d'analyse");

    const notFound = await adminUpdateAnomalyStatus(randomUUID(), "resolved");
    expect(notFound).toEqual({ ok: false, error: "admin.reconciliation.error.notFound" });
  });
});
