import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMoneyRequestById } from "./queries";
import {
  effectiveStatus,
  MoneyRequestForbiddenError,
  MoneyRequestNotFoundError,
  MoneyRequestNotPendingError,
  type MoneyRequestRow,
} from "./types";

/**
 * Annule une demande — uniquement son propre demandeur, et uniquement
 * si elle est encore effectivement `pending` (ni réglée, ni déjà
 * annulée, ni expirée). Toute autre tentative lève une erreur explicite
 * plutôt que d'échouer silencieusement.
 */
export async function cancelMoneyRequest(requestId: string, requesterUserId: string): Promise<MoneyRequestRow> {
  const request = await getMoneyRequestById(requestId);
  if (!request) throw new MoneyRequestNotFoundError(requestId);
  if (request.requester_user_id !== requesterUserId) {
    throw new MoneyRequestForbiddenError("Seul le demandeur peut annuler cette demande");
  }
  const status = effectiveStatus(request);
  if (status !== "pending") {
    throw new MoneyRequestNotPendingError(status);
  }

  // `.eq("status", "pending")` ET `.is("claimed_by_user_id", null)` rendent
  // l'annulation atomique (revue de code, corrige un bug où l'UPDATE
  // n'était conditionnée que par l'id). Le seul filtre `status` ne
  // suffisait pas : la réclamation atomique de fulfill.ts (Prompt 28)
  // pose `claimed_by_user_id` SANS changer `status` (qui reste `pending`
  // jusqu'à l'ultime écriture, une fois l'orchestrateur terminé) — une
  // annulation concurrente pouvait donc réussir entre la réclamation et
  // cette dernière écriture, avant d'être écrasée en retour par le
  // "fulfilled" final de fulfill.ts (qui, lui, n'est conditionné que par
  // claimed_by_user_id, jamais par status). Bloquer dès que la demande
  // est réclamée — qu'un règlement ait déjà abouti ou soit seulement en
  // cours — élimine cette fenêtre : un paiement déjà engagé ne doit
  // jamais pouvoir être annulé sous lui.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("money_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "pending")
    .is("claimed_by_user_id", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`cancelMoneyRequest failed: ${error.message}`);
  }
  if (!data) {
    // La demande a été réglée ou annulée entre la lecture ci-dessus et
    // cette écriture (course réelle) — jamais un écrasement silencieux.
    // Relit le statut réel pour un message d'erreur exact plutôt que
    // devinée.
    const current = await getMoneyRequestById(requestId);
    throw new MoneyRequestNotPendingError(current ? effectiveStatus(current) : "cancelled");
  }
  return data;
}
