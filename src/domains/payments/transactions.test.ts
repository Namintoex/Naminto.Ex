import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTransaction, transitionTransaction } from "./transactions";
import { InvalidTransactionTransitionError } from "./transaction-status";

/**
 * Test d'intégration contre le vrai projet Supabase de Naminto.Ex (les
 * identifiants viennent de .env.local, chargés par vitest.setup.ts).
 * Crée un utilisateur de test jetable. sender_user_id est en
 * `on delete set null` (l'historique de transaction survit à la
 * suppression d'un compte) — les transactions créées pendant le test
 * sont donc supprimées explicitement, pas seulement via la suppression
 * de l'utilisateur.
 */
describe("transactions service (intégration Supabase)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-tx-${randomUUID()}@example.test`;
  const createdTransactionIds: string[] = [];

  async function createTestTransaction(params: Omit<Parameters<typeof createTransaction>[0], "senderUserId">) {
    const tx = await createTransaction({ ...params, senderUserId: userId });
    createdTransactionIds.push(tx.id);
    return tx;
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Integration Test",
      },
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
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("crée une transaction en statut created avec référence et total corrects", async () => {
    const tx = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "orange",
      amount: 10_000,
      fee: 350,
      idempotencyKey: `vitest-${randomUUID()}`,
    });

    expect(tx.status).toBe("created");
    expect(tx.reference).toMatch(/^NEX-[A-F0-9]{8}$/);
    expect(Number(tx.total)).toBe(10_350);

    const { data: events } = await admin
      .from("transaction_status_events")
      .select("*")
      .eq("transaction_id", tx.id);
    expect(events).toHaveLength(1);
    expect(events?.[0].to_status).toBe("created");
    expect(events?.[0].from_status).toBeNull();
  });

  it("est idempotente : la même idempotencyKey ne crée jamais deux transactions", async () => {
    const idempotencyKey = `vitest-${randomUUID()}`;
    const first = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "mtn",
      amount: 5_000,
      idempotencyKey,
    });
    const second = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "mtn",
      amount: 5_000,
      idempotencyKey,
    });

    expect(second.id).toBe(first.id);

    const { count } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey);
    expect(count).toBe(1);
  });

  it("applique la State Machine sur une transition valide et journalise l'événement", async () => {
    const tx = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "wave",
      amount: 2_000,
      idempotencyKey: `vitest-${randomUUID()}`,
    });

    const updated = await transitionTransaction(tx.id, "validating");
    expect(updated.status).toBe("validating");

    const { data: events } = await admin
      .from("transaction_status_events")
      .select("*")
      .eq("transaction_id", tx.id)
      .order("created_at", { ascending: true });
    expect(events?.map((e) => e.to_status)).toEqual(["created", "validating"]);
  });

  it("refuse une transition invalide côté application (assertTransition)", async () => {
    const tx = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "moov",
      amount: 1_000,
      idempotencyKey: `vitest-${randomUUID()}`,
    });

    await expect(transitionTransaction(tx.id, "settled")).rejects.toBeInstanceOf(
      InvalidTransactionTransitionError
    );

    const stillCreated = await admin
      .from("transactions")
      .select("status")
      .eq("id", tx.id)
      .single();
    expect(stillCreated.data?.status).toBe("created");
  });

  it("le trigger de base de données refuse aussi une transition invalide (défense en profondeur)", async () => {
    const tx = await createTestTransaction({
      recipientUserId: null,
      sourceType: "naminto_wallet",
      sourceReference: null,
      destinationType: "external",
      destinationReference: null,
      provider: "prepaid_card",
      amount: 1_500,
      idempotencyKey: `vitest-${randomUUID()}`,
    });

    // Contourne délibérément le service applicatif pour prouver que la
    // base elle-même rejette la transition (pas seulement le TypeScript).
    const { error } = await admin
      .from("transactions")
      .update({ status: "settled" })
      .eq("id", tx.id);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Transition de transaction invalide");
  });
});
