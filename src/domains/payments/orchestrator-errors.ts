/**
 * Classification des erreurs du Payment Orchestrator (Prompt 09) —
 * reprend exactement les 8 codes exigés par le protocole d'origine, plus
 * deux codes ajoutés au Prompt 18 (Fraud Engine, distinct du Risk
 * Engine du Prompt 17) : `FRAUD_BLOCKED` (action BLOCK d'une règle) et
 * `MANUAL_REVIEW_REQUIRED` (action MANUAL_REVIEW — également réutilisé
 * par la future revue manuelle de Compliance, Prompt 19, plutôt que
 * dupliqué). Voir docs/DECISIONS.md ADR-046. Chaque étape du pipeline
 * lève un OrchestratorError avec le code adapté, jamais une erreur
 * générique.
 */
export type OrchestratorErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "RISK_REJECTION"
  | "FRAUD_BLOCKED"
  | "MANUAL_REVIEW_REQUIRED"
  | "COMPLIANCE_REJECTION"
  | "LIMIT_ERROR"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "SYSTEM_ERROR";

export class OrchestratorError extends Error {
  readonly code: OrchestratorErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: OrchestratorErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
    this.details = details;
  }
}
