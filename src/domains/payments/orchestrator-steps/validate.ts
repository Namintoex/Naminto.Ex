import "server-only";
import { OrchestratorError } from "../orchestrator-errors";
import { isValidPinFormat } from "@/domains/identity/pin";
import type { PaymentRequest } from "./types";

/**
 * Étape 1 — Validation structurelle. Pure : aucun accès base, aucun
 * effet de bord. Ne vérifie que la forme de la requête, pas les règles
 * métier (Risk/Compliance/Limits, étapes suivantes). `supportedCurrencies`
 * est résolu par l'appelant (orchestrator.ts, via
 * countries/profile.ts::listActiveCurrencies) — jamais une liste codée
 * en dur ici : aucune partie du cœur financier ne doit supposer
 * « FCFA uniquement » (Prompt 29, ADR-057).
 */
export function validateRequest(request: PaymentRequest, supportedCurrencies: readonly string[]): void {
  if (!request.senderUserId) {
    throw new OrchestratorError("VALIDATION_ERROR", "senderUserId manquant");
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new OrchestratorError("VALIDATION_ERROR", "Le montant doit être strictement positif");
  }
  if (!supportedCurrencies.includes(request.currency)) {
    throw new OrchestratorError("VALIDATION_ERROR", `Devise non supportée: ${request.currency}`);
  }
  if (!isValidPinFormat(request.pin)) {
    throw new OrchestratorError("VALIDATION_ERROR", "Format de PIN invalide");
  }
  if (!request.idempotencyKey) {
    throw new OrchestratorError("VALIDATION_ERROR", "idempotencyKey manquante");
  }

  if (request.sourceType === "linked_account" && !request.sourceLinkedAccountId) {
    throw new OrchestratorError(
      "VALIDATION_ERROR",
      "sourceLinkedAccountId requis quand sourceType = linked_account"
    );
  }
  if (request.destinationType === "linked_account" && !request.destinationLinkedAccountId) {
    throw new OrchestratorError(
      "VALIDATION_ERROR",
      "destinationLinkedAccountId requis quand destinationType = linked_account"
    );
  }
  if (request.destinationType === "external" && !request.destinationExternalReference) {
    throw new OrchestratorError(
      "VALIDATION_ERROR",
      "destinationExternalReference requis quand destinationType = external"
    );
  }
  if (request.destinationType === "naminto_wallet" && !request.recipientUserId) {
    throw new OrchestratorError(
      "VALIDATION_ERROR",
      "recipientUserId requis quand destinationType = naminto_wallet"
    );
  }
  if (request.sourceType === "naminto_wallet" && request.destinationType === "naminto_wallet") {
    if (request.recipientUserId === request.senderUserId) {
      throw new OrchestratorError("VALIDATION_ERROR", "Un utilisateur ne peut pas se payer lui-même");
    }
  }
}
