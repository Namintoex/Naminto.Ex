import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "./templates";
import { getChannelAdapter } from "./channels/registry";
import type {
  DeliveryOutcome,
  NotificationChannel,
  NotificationDispatchResult,
  NotificationEvent,
} from "./types";
import type { ChannelAdapter } from "./channels/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Tentatives max par canal — au-delà, la livraison reste FAILED (voir retryDelivery pour un nouvel essai plus tard). */
const MAX_ATTEMPTS = 3;

/**
 * Notification Service (Prompt 20) — point d'entrée unique : Domain Event
 * → Notification Event → Template → Channel Adapter. Ne lève JAMAIS :
 * une panne de canal (SMS, PUSH…) ne doit jamais remonter jusqu'à
 * l'appelant, encore moins annuler une transaction financière déjà
 * confirmée (contrainte explicite du Prompt 20). Tout est capturé et
 * journalisé ici ; l'appelant (ex. orchestrator-steps/notification.ts)
 * ajoute sa propre défense en profondeur par prudence, mais ne devrait
 * jamais en avoir besoin.
 */
export async function sendNotification(event: NotificationEvent): Promise<NotificationDispatchResult> {
  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("identity_profiles")
      .select("preferred_language, notifications_enabled, notify_in_app, notify_push, notify_sms, phone_number, phone_verified")
      .eq("user_id", event.userId)
      .maybeSingle();

    // Absence de profil ou interrupteur général désactivé : aucune
    // notification, jamais une erreur (même principe que le Limit Engine
    // pour l'absence de règle — l'absence n'est jamais un refus).
    if (!profile || !profile.notifications_enabled) {
      return { notificationId: null, deliveries: [] };
    }

    const locale = profile.preferred_language;
    const { title, body } = renderTemplate(event, locale);

    const { data: notification, error: insertError } = await admin
      .from("notifications")
      .insert({
        user_id: event.userId,
        event_type: event.type,
        title,
        body,
        locale,
        metadata: event.data as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (insertError || !notification) {
      console.error("[notifications] écriture de l'historique échouée", insertError);
      return { notificationId: null, deliveries: [] };
    }

    const enabledChannels: NotificationChannel[] = [
      ...(profile.notify_in_app ? (["IN_APP"] as const) : []),
      ...(profile.notify_push ? (["PUSH"] as const) : []),
      ...(profile.notify_sms ? (["SMS"] as const) : []),
    ];

    const phoneNumber = profile.phone_verified ? profile.phone_number : null;
    // Canaux indépendants (chacun sa propre ligne de livraison) : en
    // parallèle, pas en série, pour ne pas cumuler leurs latences.
    const deliveries = await Promise.all(
      enabledChannels.map((channel) =>
        dispatchChannel(admin, notification.id, channel, { title, body, phoneNumber })
      )
    );

    return { notificationId: notification.id, deliveries };
  } catch (err) {
    console.error("[notifications] sendNotification a échoué de façon inattendue", err);
    return { notificationId: null, deliveries: [] };
  }
}

async function dispatchChannel(
  admin: AdminClient,
  notificationId: string,
  channel: NotificationChannel,
  payload: { title: string; body: string; phoneNumber: string | null }
): Promise<DeliveryOutcome> {
  const adapter = getChannelAdapter(channel);

  const { data: delivery, error } = await admin
    .from("notification_deliveries")
    .insert({ notification_id: notificationId, channel, mode: adapter.mode, status: "PENDING" })
    .select("id")
    .single();

  if (error || !delivery) {
    console.error("[notifications] création de la ligne de livraison échouée", error);
    return { channel, status: "FAILED", mode: adapter.mode, error: "delivery_row_creation_failed" };
  }

  return attemptDelivery(admin, delivery.id, adapter, payload);
}

async function attemptDelivery(
  admin: AdminClient,
  deliveryId: string,
  adapter: ChannelAdapter,
  payload: { title: string; body: string; phoneNumber: string | null }
): Promise<DeliveryOutcome> {
  // UNAVAILABLE (ex. PUSH) échoue toujours de la même façon : retenter
  // n'y changerait rien, contrairement à une panne transitoire d'un
  // canal réellement connecté (REAL/SANDBOX/MOCK).
  const maxAttempts = adapter.mode === "UNAVAILABLE" ? 1 : MAX_ATTEMPTS;

  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < maxAttempts) {
    attempts += 1;
    const result = await safeSend(adapter, payload);
    if (result.success) {
      await admin
        .from("notification_deliveries")
        .update({ status: "SENT", attempts, sent_at: new Date().toISOString(), last_error: null })
        .eq("id", deliveryId);
      return { channel: adapter.channel, status: "SENT", mode: adapter.mode };
    }
    lastError = result.error;
  }

  await admin
    .from("notification_deliveries")
    .update({ status: "FAILED", attempts, last_error: lastError ?? "unknown_error" })
    .eq("id", deliveryId);
  return { channel: adapter.channel, status: "FAILED", mode: adapter.mode, error: lastError };
}

async function safeSend(
  adapter: ChannelAdapter,
  payload: { title: string; body: string; phoneNumber: string | null }
) {
  try {
    return await adapter.send(payload);
  } catch (err) {
    return { success: false, error: (err as Error).message ?? "adapter_threw" };
  }
}

/**
 * Retente une livraison précédemment FAILED (ex. depuis un futur écran
 * Back Office, Prompt 22 — aucune file d'attente/planificateur n'existe
 * dans ce dépôt, donc aucune reprise automatique différée : le retry
 * immédiat est géré par `attemptDelivery` ci-dessus). Ne lève jamais.
 */
export async function retryDelivery(deliveryId: string): Promise<DeliveryOutcome | null> {
  try {
    const admin = createAdminClient();
    const { data: delivery } = await admin
      .from("notification_deliveries")
      .select("*")
      .eq("id", deliveryId)
      .maybeSingle();
    if (!delivery || delivery.status !== "FAILED") {
      return null;
    }

    const { data: notification } = await admin
      .from("notifications")
      .select("title, body, user_id")
      .eq("id", delivery.notification_id)
      .maybeSingle();
    if (!notification) {
      return null;
    }

    const { data: profile } = await admin
      .from("identity_profiles")
      .select("phone_number, phone_verified")
      .eq("user_id", notification.user_id)
      .maybeSingle();

    const adapter = getChannelAdapter(delivery.channel);
    return attemptDelivery(admin, deliveryId, adapter, {
      title: notification.title,
      body: notification.body,
      phoneNumber: profile?.phone_verified ? profile.phone_number : null,
    });
  } catch (err) {
    console.error("[notifications] retryDelivery a échoué de façon inattendue", err);
    return null;
  }
}
