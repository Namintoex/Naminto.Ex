import "server-only";
import { OrchestratorError } from "../orchestrator-errors";
import { isValidPinFormat } from "@/domains/identity/pin";
import type { PaymentRequest } from "./types";

const SUPPORTED_CURRENCIES = ["XOF"];

/**
 * Étape 1 — Validation structurelle. Pure : aucun accès base, aucun
 * effet de bord. Ne vérifie que la forme de la requête, pas les règles
 * métier (Risk/Compliance/Limits, étapes suivantes).
 */
export function validateRequest(request: PaymentRequest): void {
  if (!request.senderUserId) {
    throw new OrchestratorError("VALIDATION_ERROR", "senderUserId manquant");
  }
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    throw new OrchestratorError("VALIDATION_ERROR", "Le montant doit être strictement positif");
  }
  if (!SUPPORTED_CURRENCIES.includes(request.currency)) {
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
