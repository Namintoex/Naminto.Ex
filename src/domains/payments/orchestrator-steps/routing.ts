import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest, ResolvedRoute } from "./types";

/**
 * Étape 7 — Routing. Détermine quel compte lié (et donc quel
 * fournisseur, via le Provider Gateway du Prompt 07) est concerné par
 * l'opération. Un virement Naminto.Ex → Naminto.Ex pur (portefeuille à
 * portefeuille) ne concerne aucun fournisseur externe : `provider` vaut
 * alors `null` et l'étape Provider Gateway est ignorée par l'orchestrateur.
 */
export async function routeRequest(request: PaymentRequest): Promise<ResolvedRoute> {
  const linkedAccountId =
    request.sourceType === "linked_account"
      ? request.sourceLinkedAccountId
      : request.destinationType === "linked_account"
        ? request.destinationLinkedAccountId
        : null;

  if (!linkedAccountId) {
    return { provider: null, linkedAccountId: null, externalReference: null };
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("linked_accounts")
    .select("id, provider, external_reference, status, user_id")
    .eq("id", linkedAccountId)
    .maybeSingle();

  if (!account || account.user_id !== request.senderUserId) {
    throw new OrchestratorError("VALIDATION_ERROR", "Compte lié introuvable ou non autorisé");
  }
  if (account.status !== "active") {
    throw new OrchestratorError("PROVIDER_ERROR", `Compte lié non actif (statut: ${account.status})`, {
      status: account.status,
    });
  }

  return {
    provider: account.provider,
    linkedAccountId: account.id,
    externalReference: account.external_reference,
  };
}
