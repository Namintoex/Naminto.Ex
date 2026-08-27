"use server";

import { revalidatePath } from "next/cache";
import { retryDelivery } from "./send-notification";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Back Office — Notifications (Prompt 22). Appelle `retryDelivery`
 * telle quelle (send-notification.ts, Prompt 20) — écrite par
 * anticipation exacte de ce bouton, aucune logique de retry
 * réimplémentée ici.
 */
export async function adminRetryDeliveryAction(deliveryId: string): Promise<AdminActionResult> {
  const result = await retryDelivery(deliveryId);
  if (!result) return { ok: false, error: "admin.notifications.error.retryFailed" };
  revalidatePath("/admin/notifications");
  return { ok: true };
}
