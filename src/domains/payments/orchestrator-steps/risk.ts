import "server-only";
import type { PaymentRequest } from "./types";

export interface RiskDecision {
  level: "LOW" | "MEDIUM" | "HIGH";
  reasons: string[];
}

/**
 * Étape 3 — Risk. STUB : le Risk Engine réel (analyse du montant, de la
 * fréquence, de l'historique, de l'appareil…) est le périmètre explicite
 * du Prompt 17. Cette étape existe déjà dans le pipeline, avec la même
 * signature qu'elle aura une fois réelle, pour que son branchement futur
 * ne modifie pas le Payment Orchestrator lui-même.
 *
 * Ne lève jamais RISK_REJECTION pour l'instant.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature stable en vue du Prompt 17
export async function checkRisk(_request: PaymentRequest): Promise<RiskDecision> {
  return { level: "LOW", reasons: ["STUB: Risk Engine non implémenté (Prompt 17)"] };
}
