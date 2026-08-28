import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderAdapter } from "@/domains/providers/registry";
import type { Provider } from "@/lib/supabase/database.types";
import { findExistingProcessedEvent, isOutOfOrder, resolveTransactionId } from "./queries";
import type { ProcessWebhookResult, WebhookEventStatus, WebhookRejectReason } from "./types";

/**
 * Fenêtre anti-rejeu — valeur raisonnable non documentée dans les
 * sources (même statut que MONEY_REQUEST_TTL_MS, Prompt 14).
 * TODO_DECISION si une autre durée est requise, voir docs/DECISIONS.md.
 */
const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

function safeParse(rawPayload: string): Record<string, unknown> {
  try {
    return JSON.parse(rawPayload);
  } catch {
    return { unparsed: rawPayload };
  }
}

async function insertAuditRow(
  admin: AdminClient,
  params: {
    provider: Provider;
    eventId: string;
    eventType: string;
    providerTransactionId: string | null;
    transactionId: string | null;
    occurredAt: string | null;
    signatureValid: boolean;
    status: WebhookEventStatus;
    rejectReason: WebhookRejectReason | null;
    payload: Record<string, unknown>;
  }
): Promise<string> {
  const { data, error } = await admin
    .from("webhook_events")
    .insert({
      provider: params.provider,
      event_id: params.eventId,
      event_type: params.eventType,
      provider_transaction_id: params.providerTransactionId,
      transaction_id: params.transactionId,
      occurred_at: params.occurredAt,
      signature_valid: params.signatureValid,
      status: params.status,
      reject_reason: params.rejectReason,
      payload: params.payload,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`webhook_events insert échoué: ${error?.message ?? "unknown error"}`);
  return data.id;
}

/**
 * Pipeline de traitement d'un webhook entrant (Prompt 25). Chaque
 * requête produit exactement une ligne `webhook_events` — acceptée ou
 * rejetée, jamais ignorée silencieusement (exigence « audité »).
 *
 * Ordre des vérifications, chacune mappée à une exigence explicite du
 * prompt : signature (authentifié/signé/protection falsification) →
 * forme du payload (vérifié/protection payload invalide) → fraîcheur
 * (horodaté/protection rejeu) → idempotence (protection duplication) →
 * ordre (protection hors-ordre) → corrélation transaction.
 *
 * Ne déclenche jamais de transition de statut de transaction ni
 * d'écriture Ledger — aucune source ne définit ce comportement
 * asynchrone (TODO_DECISION, voir docs/DECISIONS.md ADR-053). La seule
 * voie de règlement reste le Payment Orchestrator (Prompt 09) ; le
 * Reconciliation Engine (Prompt 24) reste le seul lecteur du statut
 * fournisseur consommé pour une décision.
 */
export async function processIncomingWebhook(
  provider: Provider,
  rawPayload: string,
  signatureHeader: string | null
): Promise<ProcessWebhookResult> {
  const admin = createAdminClient();
  const adapter = getProviderAdapter(provider);
  const verification = await adapter.verifyAndParseWebhook(rawPayload, signatureHeader);

  if (!verification.valid) {
    const signatureValid = verification.reason === "invalid_payload";
    const httpStatus = verification.reason === "invalid_payload" ? 400 : 401;
    const rowId = await insertAuditRow(admin, {
      provider,
      eventId: `unverified-${randomUUID()}`,
      eventType: "unknown",
      providerTransactionId: null,
      transactionId: null,
      occurredAt: null,
      signatureValid,
      status: "rejected",
      rejectReason: verification.reason,
      payload: safeParse(rawPayload),
    });
    return { httpStatus, status: "rejected", reason: verification.reason, eventRowId: rowId };
  }

  const { event } = verification;
  const occurredAtMs = Date.parse(event.occurredAt);
  const now = Date.now();

  if (now - occurredAtMs > REPLAY_WINDOW_MS || occurredAtMs - now > CLOCK_SKEW_TOLERANCE_MS) {
    const rowId = await insertAuditRow(admin, {
      provider,
      eventId: event.eventId,
      eventType: event.type,
      providerTransactionId: event.providerTransactionId ?? null,
      transactionId: null,
      occurredAt: event.occurredAt,
      signatureValid: true,
      status: "rejected",
      rejectReason: "stale_replay",
      payload: event.raw as Record<string, unknown>,
    });
    return { httpStatus: 200, status: "rejected", reason: "stale_replay", eventRowId: rowId };
  }

  if (await findExistingProcessedEvent(admin, provider, event.eventId)) {
    const rowId = await insertAuditRow(admin, {
      provider,
      eventId: event.eventId,
      eventType: event.type,
      providerTransactionId: event.providerTransactionId ?? null,
      transactionId: null,
      occurredAt: event.occurredAt,
      signatureValid: true,
      status: "duplicate",
      rejectReason: null,
      payload: event.raw as Record<string, unknown>,
    });
    return { httpStatus: 200, status: "duplicate", eventRowId: rowId };
  }

  if (await isOutOfOrder(admin, provider, event.providerTransactionId ?? null, event.occurredAt)) {
    const rowId = await insertAuditRow(admin, {
      provider,
      eventId: event.eventId,
      eventType: event.type,
      providerTransactionId: event.providerTransactionId ?? null,
      transactionId: null,
      occurredAt: event.occurredAt,
      signatureValid: true,
      status: "rejected",
      rejectReason: "out_of_order",
      payload: event.raw as Record<string, unknown>,
    });
    return { httpStatus: 200, status: "rejected", reason: "out_of_order", eventRowId: rowId };
  }

  const transactionId = await resolveTransactionId(admin, provider, event.providerTransactionId ?? null);
  const rowId = await insertAuditRow(admin, {
    provider,
    eventId: event.eventId,
    eventType: event.type,
    providerTransactionId: event.providerTransactionId ?? null,
    transactionId,
    occurredAt: event.occurredAt,
    signatureValid: true,
    status: "processed",
    rejectReason: null,
    payload: event.raw as Record<string, unknown>,
  });
  return { httpStatus: 200, status: "processed", eventRowId: rowId };
}
