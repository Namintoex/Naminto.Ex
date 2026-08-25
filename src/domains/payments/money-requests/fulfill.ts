import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPaymentOrchestrator } from "../orchestrator";
import { getMoneyRequestByToken } from "./queries";
import {
  effectiveStatus,
  MoneyRequestForbiddenError,
  MoneyRequestNotFoundError,
  MoneyRequestNotPendingError,
} from "./types";

export interface FulfillMoneyRequestParams {
  token: string;
  payerUserId: string;
  pin: string;
}

export interface FulfillMoneyRequestResult {
  transactionId: string;
  reference: string;
  status: string;
}

/**
 * Règle une demande d'argent par un envoi réel — délègue entièrement au
 * Payment Orchestrator (Prompts 09-13), aucune logique financière ici.
 * `idempotencyKey` déterministe par jeton de demande : un double clic ou
 * un rejeu réseau sur le même lien ne peut jamais produire deux
 * transactions pour la même demande.
 */
export async function fulfillMoneyRequest(params: FulfillMoneyRequestParams): Promise<FulfillMoneyRequestResult> {
  const request = await getMoneyRequestByToken(params.token);
  if (!request) throw new MoneyRequestNotFoundError(params.token);
  if (request.requester_user_id === params.payerUserId) {
    throw new MoneyRequestForbiddenError("Vous ne pouvez pas régler votre propre demande");
  }
  const status = effectiveStatus(request);

  // Rejeu idempotent : une demande déjà réglée par ce même payeur (double
  // clic, coupure réseau après règlement) renvoie le résultat existant
  // sans rappeler l'orchestrateur — jamais une deuxième transaction, et
  // jamais un faux MoneyRequestNotPendingError pour ce cas légitime.
  if (status === "fulfilled" && request.fulfilled_transaction_id) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("transactions")
      .select("id, reference, status, sender_user_id")
      .eq("id", request.fulfilled_transaction_id)
      .single();
    if (existing?.sender_user_id === params.payerUserId) {
      return { transactionId: existing.id, reference: existing.reference, status: existing.status };
    }
    throw new MoneyRequestNotPendingError(status);
  }

  if (status !== "pending") {
    throw new MoneyRequestNotPendingError(status);
  }

  const { transaction } = await runPaymentOrchestrator({
    senderUserId: params.payerUserId,
    recipientUserId: request.requester_user_id,
    sourceType: "naminto_wallet",
    sourceLinkedAccountId: null,
    destinationType: "naminto_wallet",
    destinationLinkedAccountId: null,
    destinationExternalReference: null,
    amount: Number(request.amount),
    currency: request.currency,
    pin: params.pin,
    idempotencyKey: `money-request-${request.token}`,
  });

  // Conditionnel sur status = 'pending' : si une tentative concurrente a
  // déjà marqué la demande réglée entre-temps, ne pas écraser son
  // fulfilled_transaction_id — cas résiduel non totalement exclu, voir
  // docs/DECISIONS.md ADR-042.
  const admin = createAdminClient();
  await admin
    .from("money_requests")
    .update({ status: "fulfilled", fulfilled_transaction_id: transaction.id })
    .eq("id", request.id)
    .eq("status", "pending");

  return { transactionId: transaction.id, reference: transaction.reference, status: transaction.status };
}
