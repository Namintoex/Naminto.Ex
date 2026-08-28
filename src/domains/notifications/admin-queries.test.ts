import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminListNotifications } from "./admin-queries";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie que la
 * liste Back Office n'expose plus `body` (montant/référence exacts)
 * au navigateur alors que seul le titre est affiché (Prompt 28, ADR-056).
 */
describe("notifications — admin-queries (intégration, Prompt 28)", () => {
  const admin = createAdminClient();
  let userId: string;
  let notificationId: string;
  const email = `vitest-notifadminq-${randomUUID()}@example.test`;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: { naminto_id: `vitest_notifq_${randomUUID().slice(0, 8)}`, legal_name: "Vitest Notif AdminQ" },
    });
    if (error || !data.user) throw new Error(`Setup échoué: ${error?.message}`);
    userId = data.user.id;

    const { data: notif } = await admin
      .from("notifications")
      .insert({
        user_id: userId,
        event_type: "transaction_settled",
        title: "Titre visible",
        body: "Corps sensible : 25 000 XOF, réf. NEX-SECRET1",
        locale: "fr",
        metadata: { reference: "NEX-SECRET1", amount: 25000 },
      })
      .select("id")
      .single();
    notificationId = notif!.id;

    await admin.from("notification_deliveries").insert({
      notification_id: notificationId,
      channel: "IN_APP",
      status: "SENT",
      mode: "SANDBOX",
    });
  });

  afterAll(async () => {
    if (notificationId) await admin.from("notifications").delete().eq("id", notificationId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("n'expose jamais body/metadata/user_id, seulement titre/type/date et canal/statut par livraison", async () => {
    const result = await adminListNotifications(1);
    const row = result.notifications.find((n) => n.id === notificationId);
    expect(row).toBeTruthy();

    expect(row).toEqual({
      id: notificationId,
      title: "Titre visible",
      event_type: "transaction_settled",
      created_at: expect.any(String),
      deliveries: [{ id: expect.any(String), channel: "IN_APP", status: "SENT" }],
    });
    expect(row).not.toHaveProperty("body");
    expect(row).not.toHaveProperty("metadata");
    expect(row).not.toHaveProperty("user_id");
  });
});
