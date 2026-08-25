import "server-only";
import { verifyPinForUser } from "@/domains/identity/pin";
import { OrchestratorError } from "../orchestrator-errors";
import type { PaymentRequest } from "./types";

/**
 * Étape 2 — Authentification. Réutilise la vérification de PIN du
 * domaine Identity (Prompt 04) — ne duplique jamais la logique de
 * verrouillage.
 */
export async function authenticateRequest(request: PaymentRequest): Promise<void> {
  const result = await verifyPinForUser(request.senderUserId, request.pin);
  if (!result.ok) {
    throw new OrchestratorError("AUTH_ERROR", `Échec d'authentification PIN: ${result.reason}`, {
      reason: result.reason,
    });
  }
}
