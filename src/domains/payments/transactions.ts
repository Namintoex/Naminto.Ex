import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTransition, type TransactionStatus } from "./transaction-status";
import type {
  DestinationType,
  FeePayer,
  Provider,
  SourceType,
} from "@/lib/supabase/database.types";

/**
 * Point d'entrée unique en écriture du modèle Transaction (Prompt 08).
 * Utilise toujours le client service_role : la table `transactions` n'a
 * aucune policy RLS d'écriture — la seule façon de créer une transaction
 * ou de faire évoluer son statut est de passer par ces fonctions, qui
 * appliquent la State Machine avant toute écriture (revalidée une
 * deuxième fois côté base par un trigger, en défense en profondeur).
 */

export interface CreateTransactionParams {
  senderUserId: string | null;
  recipientUserId: string | null;
  sourceType: SourceType;
  sourceReference: string | null;
  destinationType: DestinationType;
  destinationReference: string | null;
  /** Référence texte libre d'un bénéficiaire externe (ex. numéro de
   *  téléphone) quand destinationType = 'external' — distincte de
   *  destinationReference (uuid, réservé aux comptes liés). */
  destinationExternalReference?: string | null;
  provider: Provider | null;
  amount: number;
  currency?: string;
  fee?: number;
  feePayer?: FeePayer;
  idempotencyKey: string;
}

function generateReference(): string {
  return `NEX-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

async function recordStatusEvent(
  transactionId: string,
  fromStatus: TransactionStatus | null,
  toStatus: TransactionStatus,
  reason?: string
) {
  const admin = createAdminClient();
  await admin.from("transaction_status_events").insert({
    transaction_id: transactionId,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason ?? null,
  });
}

/**
 * Crée une transaction en statut initial `created`. Idempotente : un
 * appel répété avec la même idempotencyKey renvoie la transaction déjà
 * créée plutôt que d'en produire une seconde (Master Prompt, section 6).
 */
export async function createTransaction(params: CreateTransactionParams) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("transactions")
    .select("*")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return existing;
  }

  const fee = params.fee ?? 0;
  const { data, error } = await admin
    .from("transactions")
    .insert({
      reference: generateReference(),
      idempotency_key: params.idempotencyKey,
      sender_user_id: params.senderUserId,
      recipient_user_id: params.recipientUserId,
      source_type: params.sourceType,
      source_reference: params.sourceReference,
      destination_type: params.destinationType,
      destination_reference: params.destinationReference,
      destination_external_reference: params.destinationExternalReference ?? null,
      provider: params.provider,
      amount: params.amount,
      currency: params.currency ?? "XOF",
      fee,
      total: params.amount + fee,
      fee_payer: params.feePayer ?? "sender",
      status: "created",
    })
    .select("*")
    .single();

  if (data) {
    await recordStatusEvent(data.id, null, "created");
    return data;
  }

  // Course entre deux appels concurrents avec la même idempotencyKey
  // (Prompt 28, ADR-056) : celui qui perd sur la contrainte unique
  // relit simplement la transaction créée par l'autre, au lieu de faire
  // échouer tout l'orchestrateur pour une requête pourtant légitimement
  // idempotente — même correctif déjà appliqué à getOrCreateLedgerAccount.
  if (error?.code === "23505") {
    const { data: retried } = await admin
      .from("transactions")
      .select("*")
      .eq("idempotency_key", params.idempotencyKey)
      .maybeSingle();
    if (retried) return retried;
  }

  throw new Error(`createTransaction failed: ${error?.message ?? "unknown error"}`);
}

/**
 * Fait évoluer le statut d'une transaction. Lève
 * InvalidTransactionTransitionError (voir transaction-status.ts) si la
 * transition demandée n'est pas autorisée — jamais de modification
 * libre du statut, y compris depuis ce service.
 */
export async function transitionTransaction(
  transactionId: string,
  to: TransactionStatus,
  reason?: string,
  extra?: { providerTransactionId?: string | null }
) {
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("transactions")
    .select("status")
    .eq("id", transactionId)
    .single();

  if (readError || !current) {
    throw new Error(`transitionTransaction: transaction introuvable (${transactionId})`);
  }

  assertTransition(current.status, to);

  const { data: updated, error: updateError } = await admin
    .from("transactions")
    .update({
      status: to,
      ...(extra?.providerTransactionId !== undefined
        ? { provider_transaction_id: extra.providerTransactionId }
        : {}),
    })
    .eq("id", transactionId)
    .select("*")
    .single();

  if (updateError || !updated) {
    throw new Error(`transitionTransaction failed: ${updateError?.message ?? "unknown error"}`);
  }

  await recordStatusEvent(transactionId, current.status, to, reason);
  return updated;
}

export async function getTransactionById(transactionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("transactions").select("*").eq("id", transactionId).maybeSingle();
  return data;
}
