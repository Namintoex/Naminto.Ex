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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("money_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`cancelMoneyRequest failed: ${error?.message ?? "unknown error"}`);
  }
  return data;
}
