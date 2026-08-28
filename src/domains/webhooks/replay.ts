import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebhookEventStatus } from "@/lib/supabase/database.types";
import { findExistingProcessedEvent, isOutOfOrder, resolveTransactionId } from "./queries";

export type AdminReplayResult = { ok: true; eventRowId: string } | { ok: false; error: string };

/**
 * Rejeu contrôlé (Prompt 25, exigence explicite) — distinct d'un rejeu
 * non contrôlé (une attaque, bloquée par la fenêtre anti-rejeu de
 * process-webhook.ts) : déclenché explicitement par un administrateur
 * habilité (permission webhook.manage), toujours audité (`replay_of`/
 * `replayed_by`, nouvelle ligne — l'originale n'est jamais modifiée).
 * Seule la fraîcheur est volontairement ignorée (une donnée historique
 * est par nature hors de cette fenêtre) — idempotence et détection
 * hors-ordre restent appliquées, revérifiées contre l'état actuel.
 */
export async function adminReplayWebhookEvent(
  eventRowId: string,
  adminUserId: string
): Promise<AdminReplayResult> {
  const admin = createAdminClient();

  const { data: original } = await admin.from("webhook_events").select("*").eq("id", eventRowId).maybeSingle();
  if (!original) return { ok: false, error: "admin.webhooks.error.notFound" };
  if (!original.signature_valid) return { ok: false, error: "admin.webhooks.error.cannotReplayInvalid" };

  let status: WebhookEventStatus;
  let rejectReason: string | null = null;
  let transactionId = original.transaction_id;

  if (await findExistingProcessedEvent(admin, original.provider, original.event_id)) {
    status = "duplicate";
  } else if (
    await isOutOfOrder(admin, original.provider, original.provider_transaction_id, original.occurred_at)
  ) {
    status = "rejected";
    rejectReason = "out_of_order";
  } else {
    status = "processed";
    if (!transactionId) {
      transactionId = await resolveTransactionId(admin, original.provider, original.provider_transaction_id);
    }
  }

  const { data: replayRow, error } = await admin
    .from("webhook_events")
    .insert({
      provider: original.provider,
      event_id: original.event_id,
      event_type: original.event_type,
      provider_transaction_id: original.provider_transaction_id,
      transaction_id: transactionId,
      occurred_at: original.occurred_at,
      signature_valid: true,
      status,
      reject_reason: rejectReason,
      payload: original.payload,
      replay_of: original.id,
      replayed_by: adminUserId,
    })
    .select("id")
    .single();
  if (error || !replayRow) return { ok: false, error: "admin.webhooks.error.replayFailed" };

  return { ok: true, eventRowId: replayRow.id };
}
