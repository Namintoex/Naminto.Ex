import { randomUUID } from "crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotification, retryDelivery } from "./send-notification";

/**
 * Test d'intégration contre le vrai projet Supabase — un utilisateur de
 * test obtient automatiquement un identity_profiles (trigger
 * on_auth_user_created, 0001_identity.sql) avec les valeurs par défaut
 * (notifications activées, tous les canaux activés, aucun téléphone
 * vérifié) : exactement le terrain nécessaire pour exercer les trois
 * canaux (IN_APP réel, PUSH indisponible, SMS sandbox sans téléphone).
 */
describe("Notification Engine — sendNotification (intégration)", () => {
  const admin = createAdminClient();
  let userId: string;
  const testEmail = `vitest-notifications-${randomUUID()}@example.test`;

  const DEFAULT_PROFILE_STATE = {
    notifications_enabled: true,
    notify_in_app: true,
    notify_push: true,
    notify_sms: true,
    phone_number: null as string | null,
    phone_verified: false,
  };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: "TestPassword2026!",
      email_confirm: true,
      user_metadata: {
        naminto_id: `vitest_notif_${randomUUID().slice(0, 8)}`,
        legal_name: "Vitest Notification Engine Test",
      },
    });
    if (error || !data.user) {
      throw new Error(`Impossible de créer l'utilisateur de test: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterEach(async () => {
    await admin.from("identity_profiles").update(DEFAULT_PROFILE_STATE).eq("user_id", userId);
  });

  afterAll(async () => {
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
    }
  });

  it("envoie sur les trois canaux : IN_APP réussit, PUSH échoue (indisponible), SMS échoue (aucun téléphone vérifié)", async () => {
    const result = await sendNotification({
      type: "transaction_settled",
      userId,
      data: { reference: "NEX-TEST0001", amount: 5000, currency: "XOF", direction: "sent" },
    });

    expect(result.notificationId).not.toBeNull();
    expect(result.deliveries).toHaveLength(3);

    const byChannel = Object.fromEntries(result.deliveries.map((d) => [d.channel, d]));
    expect(byChannel.IN_APP).toMatchObject({ status: "SENT", mode: "REAL" });
    expect(byChannel.PUSH).toMatchObject({ status: "FAILED", mode: "UNAVAILABLE" });
    expect(byChannel.SMS).toMatchObject({ status: "FAILED", mode: "SANDBOX" });

    const { data: notification } = await admin
      .from("notifications")
      .select("*")
      .eq("id", result.notificationId!)
      .single();
    expect(notification).toMatchObject({
      user_id: userId,
      event_type: "transaction_settled",
      locale: "fr",
      title: "Envoi confirmé",
    });
    expect(notification!.body).toContain("NEX-TEST0001");

    const { data: deliveryRows } = await admin
      .from("notification_deliveries")
      .select("*")
      .eq("notification_id", result.notificationId!);
    expect(deliveryRows).toHaveLength(3);
    expect(deliveryRows!.find((d) => d.channel === "PUSH")?.attempts).toBe(1); // pas de retry inutile pour UNAVAILABLE
    expect(deliveryRows!.find((d) => d.channel === "SMS")?.attempts).toBe(3); // retries épuisés pour SANDBOX
  });

  it("notifications_enabled = false ⇒ aucune notification créée (interrupteur général)", async () => {
    await admin.from("identity_profiles").update({ notifications_enabled: false }).eq("user_id", userId);

    const result = await sendNotification({
      type: "transaction_settled",
      userId,
      data: { reference: "NEX-TEST0002", amount: 1000, currency: "XOF", direction: "sent" },
    });

    expect(result).toEqual({ notificationId: null, deliveries: [] });
  });

  it("respecte les préférences par canal (notify_push = false ⇒ pas de tentative PUSH)", async () => {
    await admin.from("identity_profiles").update({ notify_push: false }).eq("user_id", userId);

    const result = await sendNotification({
      type: "transaction_settled",
      userId,
      data: { reference: "NEX-TEST0003", amount: 2000, currency: "XOF", direction: "received" },
    });

    const channels = result.deliveries.map((d) => d.channel);
    expect(channels).toContain("IN_APP");
    expect(channels).toContain("SMS");
    expect(channels).not.toContain("PUSH");
  });

  it("un numéro vérifié permet à SMS de réussir (SANDBOX, simulé)", async () => {
    await admin
      .from("identity_profiles")
      .update({ phone_number: "+2250700000000", phone_verified: true })
      .eq("user_id", userId);

    const result = await sendNotification({
      type: "transaction_failed",
      userId,
      data: { reference: "NEX-TEST0004", amount: 3000, currency: "XOF", reasonCode: "PROVIDER_ERROR" },
    });

    const sms = result.deliveries.find((d) => d.channel === "SMS");
    expect(sms).toMatchObject({ status: "SENT", mode: "SANDBOX" });
  });

  it("retryDelivery relance une livraison FAILED et réussit une fois la précondition levée", async () => {
    const initial = await sendNotification({
      type: "transaction_settled",
      userId,
      data: { reference: "NEX-TEST0005", amount: 4000, currency: "XOF", direction: "sent" },
    });
    const failedSms = initial.deliveries.find((d) => d.channel === "SMS");
    expect(failedSms?.status).toBe("FAILED");

    const { data: deliveryRow } = await admin
      .from("notification_deliveries")
      .select("id")
      .eq("notification_id", initial.notificationId!)
      .eq("channel", "SMS")
      .single();

    // Corrige la précondition (téléphone vérifié) puis relance la même livraison.
    await admin
      .from("identity_profiles")
      .update({ phone_number: "+2250700000001", phone_verified: true })
      .eq("user_id", userId);

    const retried = await retryDelivery(deliveryRow!.id);
    expect(retried).toMatchObject({ channel: "SMS", status: "SENT", mode: "SANDBOX" });

    const { data: updatedDelivery } = await admin
      .from("notification_deliveries")
      .select("status")
      .eq("id", deliveryRow!.id)
      .single();
    expect(updatedDelivery?.status).toBe("SENT");
  });

  it("retryDelivery renvoie null pour une livraison qui n'est pas FAILED", async () => {
    const initial = await sendNotification({
      type: "transaction_settled",
      userId,
      data: { reference: "NEX-TEST0006", amount: 1500, currency: "XOF", direction: "sent" },
    });
    const sentInApp = initial.deliveries.find((d) => d.channel === "IN_APP");
    expect(sentInApp?.status).toBe("SENT");

    const { data: deliveryRow } = await admin
      .from("notification_deliveries")
      .select("id")
      .eq("notification_id", initial.notificationId!)
      .eq("channel", "IN_APP")
      .single();

    const result = await retryDelivery(deliveryRow!.id);
    expect(result).toBeNull();
  });
});
