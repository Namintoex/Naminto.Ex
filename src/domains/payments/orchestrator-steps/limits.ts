import "server-only";
import type { PaymentRequest } from "./types";

/**
 * Étape 5 — Limits. STUB : le Limit Engine réel (limites journalières,
 * mensuelles, par transaction, par fréquence — configurables par
 * utilisateur/KYC/pays/devise) est le périmètre explicite du Prompt 11.
 *
 * Ne lève jamais LIMIT_ERROR pour l'instant.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature stable en vue du Prompt 11
export async function checkLimits(_request: PaymentRequest): Promise<void> {
  // STUB: Limit Engine non implémenté (Prompt 11)
}
