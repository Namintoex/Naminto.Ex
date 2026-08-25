import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCounterparty } from "./queries";
import type { Database } from "@/lib/supabase/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function baseTx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: randomUUID(),
    reference: "NEX-TESTTEST",
    idempotency_key: randomUUID(),
    sender_user_id: null,
    recipient_user_id: null,
    source_type: "naminto_wallet",
    source_reference: null,
    destination_type: "naminto_wallet",
    destination_reference: null,
    destination_external_reference: null,
    provider: null,
    amount: 1000,
    currency: "XOF",
    fee: 0,
    total: 1000,
    fee_payer: "sender",
    status: "settled",
    provider_transaction_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * `resolveCounterparty` (Prompt 16) ne dépend que de `getPublicProfile`
 * (service_role, testable) — contrairement à `listTransactions` /
 * `getTransactionByReference` / `getTransactionTimeline`, qui passent
 * par le client RLS (`cookies()`) et ne sont donc testables que dans un
 * vrai contexte de requête Next.js (comme `listOwnMoneyRequests`,
 * Prompt 14) — vérifiées manuellement dans le navigateur.
 */
describe("resolveCounterparty (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-history-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_hist_${randomUUID().slice(0, 8)}`, legal_name: "Vitest History Counterparty" },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("expéditeur → destinataire Naminto.Ex réel : résout le nom légal", async () => {
    const tx = baseTx({ sender_user_id: "viewer", recipient_user_id: userId, destination_type: "naminto_wallet" });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "user", label: "Vitest History Counterparty" });
  });

  it("expéditeur → destinataire externe : renvoie la référence externe telle quelle", async () => {
    const tx = baseTx({
      sender_user_id: "viewer",
      destination_type: "external",
      destination_external_reference: "+225070000000",
    });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "external", label: "+225070000000" });
  });

  it("expéditeur → son propre compte lié : jamais présenté comme une autre personne", async () => {
    const tx = baseTx({ sender_user_id: "viewer", destination_type: "linked_account", provider: "orange" });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "own_linked_account", label: "orange" });
  });

  it("destinataire → expéditeur Naminto.Ex réel : résout le nom légal", async () => {
    const tx = baseTx({ sender_user_id: userId, recipient_user_id: "viewer", source_type: "naminto_wallet" });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "user", label: "Vitest History Counterparty" });
  });

  it("destinataire → source via compte lié (fournisseur) : jamais un nom inventé", async () => {
    const tx = baseTx({ recipient_user_id: "viewer", source_type: "linked_account", provider: "wave" });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "external", label: "wave" });
  });

  it("profil introuvable : renvoie « — », jamais une valeur inventée", async () => {
    const tx = baseTx({
      sender_user_id: "viewer",
      recipient_user_id: randomUUID(),
      destination_type: "naminto_wallet",
    });
    const result = await resolveCounterparty(tx, "viewer");
    expect(result).toEqual({ kind: "user", label: "—" });
  });
});
