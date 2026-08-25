/**
 * Classification des erreurs du Payment Orchestrator (Prompt 09) — reprend
 * exactement les 8 codes exigés par le protocole. Chaque étape du
 * pipeline lève un OrchestratorError avec le code adapté, jamais une
 * erreur générique.
 */
export type OrchestratorErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "RISK_REJECTION"
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
