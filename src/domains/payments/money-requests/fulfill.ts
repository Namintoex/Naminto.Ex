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
import type { Database } from "@/lib/supabase/database.types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export interface FulfillMoneyRequestParams {
  token: string;
  payerUserId: string;
  pin: string;
  deviceFingerprint?: string | null;
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

  // Réclamation atomique (Prompt 28, ADR-056) — AVANT tout appel à
  // l'orchestrateur. Sans elle, deux payeurs concurrents pouvaient tous
  // deux dépasser la vérification `status === "pending"` ci-dessus,
  // partager la même idempotencyKey, et l'un des deux finissait par
  // authentifier son propre PIN et faire progresser une transaction dont
  // le sender_user_id réel était l'AUTRE payeur (l'orchestrateur suit
  // `isInFlight` sans revérifier l'identité de l'appelant). L'UPDATE
  // conditionnelle ci-dessous ne peut jamais réussir pour deux payeurs
  // concurrents distincts : Postgres sérialise sur le verrou de ligne,
  // le perdant voit `status` déjà différent de 'pending' (ou
  // `claimed_by_user_id` déjà posé par le gagnant) et n'affecte aucune
  // ligne — rejeté avant même de saisir son PIN.
  // `.gt("expires_at", ...)` (revue de code) : sans elle, l'atomicité ne
  // couvrait que le double-paiement, pas l'expiration — une demande dont
  // l'échéance tombe entre la lecture ci-dessus et cette écriture pouvait
  // encore être réclamée et réglée après son expiration effective.
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("money_requests")
    .update({ claimed_by_user_id: params.payerUserId })
    .eq("id", request.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .or(`claimed_by_user_id.is.null,claimed_by_user_id.eq.${params.payerUserId}`)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    throw new MoneyRequestNotPendingError(status);
  }

  let transaction: Transaction;
  try {
    ({ transaction } = await runPaymentOrchestrator({
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
      // Propre à CE payeur (Prompt 28, ADR-056) — auparavant partagée
      // par tous les payeurs potentiels du même jeton, ce qui permettait
      // à deux payeurs concurrents de finir liés à la même transaction.
      // L'exclusivité "un seul règlement par demande" est désormais
      // garantie par la réclamation ci-dessus, pas par l'idempotencyKey.
      idempotencyKey: `money-request-${request.token}-${params.payerUserId}`,
      deviceFingerprint: params.deviceFingerprint ?? null,
    }));
  } catch (err) {
    // Libère la réclamation pour permettre un nouvel essai (par ce
    // payeur ou un autre) — jamais laisser la demande bloquée
    // indéfiniment après un échec (mauvais PIN, risque, etc.).
    await admin
      .from("money_requests")
      .update({ claimed_by_user_id: null })
      .eq("id", request.id)
      .eq("status", "pending")
      .eq("claimed_by_user_id", params.payerUserId);
    throw err;
  }

  // Le transfert a déjà réellement eu lieu à ce stade (l'orchestrateur a
  // réussi) : un échec de cette dernière écriture ne doit jamais faire
  // échouer fulfillMoneyRequest ni annuler quoi que ce soit — seulement
  // être journalisé (revue de code : cette erreur était auparavant
  // totalement silencieuse, laissant la demande visible comme "pending"
  // malgré un règlement réel).
  const { error: statusFlipError } = await admin
    .from("money_requests")
    .update({ status: "fulfilled", fulfilled_transaction_id: transaction.id })
    .eq("id", request.id)
    .eq("claimed_by_user_id", params.payerUserId);
  if (statusFlipError) {
    console.error(
      `[fulfillMoneyRequest] échec de la mise à jour finale du statut (transaction ${transaction.id} pourtant réglée) — demande ${request.id} reste visible comme non réglée`,
      statusFlipError
    );
  }

  return { transactionId: transaction.id, reference: transaction.reference, status: transaction.status };
}
