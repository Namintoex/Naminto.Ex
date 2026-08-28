import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTransactionSettled } from "./notification";
import type { Database } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

/**
 * Intégration réelle Supabase — vérifie le paramètre `skipUserIds` de
 * `notifyTransactionSettled` (revue de code) : un règlement portefeuille-
 * à-portefeuille notifie deux destinataires indépendants (expéditeur et
 * destinataire) pour la même référence — sans ce paramètre, le consumer
 * d'événement (`notification-consumer.ts`) sautait tout retraitement dès
 * qu'UN SEUL des deux avait déjà sa ligne, laissant le second jamais
 * notifié après une interruption entre les deux envois.
 */
describe("notifyTransactionSettled — skipUserIds (intégration)", () => {
  const admin = createAdminClient();
  let senderId: string;
  let recipientId: string;
  const senderEmail = `vitest-notif-sender-${randomUUID()}@example.test`;
  const recipientEmail = `vitest-notif-recipient-${randomUUID()}@example.test`;
  const createdNotificationIds: string[] = [];

  function fakeTransaction(reference: string): Transaction {
    return {
      id: randomUUID(),
      reference,
      idempotency_key: `vitest-notif-${randomUUID()}`,
      sender_user_id: senderId,
      recipient_user_id: recipientId,
      source_type: "naminto_wallet",
      source_reference: null,
      destination_type: "naminto_wallet",
      destination_reference: null,
      destination_external_reference: null,
      provider: null,
      amount: 1_000,
      currency: "XOF",
      fee: 0,
      total: 1_000,
      fee_payer: "sender",
      status: "settled",
      provider_transaction_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  beforeAll(async () => {
    const sender = await admin.auth.admin.createUser({
      email: senderEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_notif_s_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Sender" },
    });
    if (sender.error || !sender.data.user) throw new Error(`Impossible de créer l'expéditeur: ${sender.error?.message}`);
    senderId = sender.data.user.id;

    const recipient = await admin.auth.admin.createUser({
      email: recipientEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_notif_r_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Recipient" },
    });
    if (recipient.error || !recipient.data.user) throw new Error(`Impossible de créer le destinataire: ${recipient.error?.message}`);
    recipientId = recipient.data.user.id;
  });

  afterAll(async () => {
    if (createdNotificationIds.length > 0) await admin.from("notifications").delete().in("id", createdNotificationIds);
    if (senderId) await admin.auth.admin.deleteUser(senderId);
    if (recipientId) await admin.auth.admin.deleteUser(recipientId);
  });

  it("sans skipUserIds : notifie les deux destinataires", async () => {
    const reference = `NEX-VITEST-${randomUUID().slice(0, 8).toUpperCase()}`;
    await notifyTransactionSettled(fakeTransaction(reference));

    const { data: rows } = await admin
      .from("notifications")
      .select("id, user_id")
      .eq("event_type", "transaction_settled")
      .contains("metadata", { reference });
    (rows ?? []).forEach((r) => createdNotificationIds.push(r.id));

    const userIds = (rows ?? []).map((r) => r.user_id);
    expect(userIds).toContain(senderId);
    expect(userIds).toContain(recipientId);
  });

  it("avec skipUserIds contenant l'expéditeur : notifie seulement le destinataire (retry après succès partiel)", async () => {
    const reference = `NEX-VITEST-${randomUUID().slice(0, 8).toUpperCase()}`;
    await notifyTransactionSettled(fakeTransaction(reference), new Set([senderId]));

    const { data: rows } = await admin
      .from("notifications")
      .select("id, user_id")
      .eq("event_type", "transaction_settled")
      .contains("metadata", { reference });
    (rows ?? []).forEach((r) => createdNotificationIds.push(r.id));

    const userIds = (rows ?? []).map((r) => r.user_id);
    expect(userIds).not.toContain(senderId);
    expect(userIds).toContain(recipientId);
  });
});
