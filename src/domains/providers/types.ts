import type { Provider } from "@/lib/supabase/database.types";

/**
 * Distinction obligatoire (Master Prompt, section 3 : "Zero fausse
 * intégration financière"). Aucun adapter ne doit jamais se présenter en
 * REAL tant qu'il n'est pas réellement connecté à l'API du fournisseur.
 */
export type ProviderMode = "REAL" | "SANDBOX" | "MOCK" | "UNAVAILABLE";

/** Reprend les états de l'Availability Engine (architecture, section 47). */
export type HealthStatus = "operational" | "degraded" | "unavailable" | "maintenance";

export type ProviderTransactionStatus = "pending" | "confirmed" | "failed" | "unknown";

export interface ProviderLinkParams {
  externalReference: string;
}

export interface ProviderLinkResult {
  externalReference: string;
  capabilities: string[];
  status: "active" | "verification_required";
}

export interface ProviderBalance {
  amount: number;
  currency: string;
  asOf: string;
}

export interface ProviderTransferParams {
  externalReference: string;
  amount: number;
  currency: string;
  /** Empêche toute double exécution (Master Prompt, section 6). */
  idempotencyKey: string;
  reference: string;
}

export interface ProviderTransferResult {
  providerTransactionId: string;
  status: ProviderTransactionStatus;
  reason?: string;
}

export interface ProviderCancelResult {
  success: boolean;
  status: ProviderTransactionStatus;
}

export interface ProviderRefundResult {
  supported: boolean;
  success?: boolean;
  providerRefundId?: string;
}

export interface ProviderWebhookEvent {
  type: string;
  /** Identifiant d'événement fourni par le fournisseur — clé d'idempotence (Prompt 25). */
  eventId: string;
  /** Horodatage revendiqué par le payload (ISO 8601) — utilisé pour la fenêtre anti-rejeu et la détection hors-ordre (Prompt 25). */
  occurredAt: string;
  providerTransactionId?: string;
  status?: ProviderTransactionStatus;
  raw: unknown;
}

/**
 * Résultat de vérification (Prompt 25) — jamais une exception : une
 * signature invalide ou un payload malformé doivent rester audités
 * (webhook_events), pas seulement journalisés en erreur puis perdus.
 */
export type ProviderWebhookVerification =
  | { valid: true; event: ProviderWebhookEvent }
  | { valid: false; reason: "missing_signature" | "invalid_signature" | "invalid_payload" };

export interface ProviderHealth {
  status: HealthStatus;
  checkedAt: string;
}

/**
 * Interface commune à tous les fournisseurs (Prompt 07). Le cœur financier
 * de Naminto.Ex ne doit jamais connaître un fournisseur concret — il ne
 * dépend que de cette interface, résolue via le Provider Registry.
 */
export interface ProviderAdapter {
  readonly provider: Provider;
  readonly mode: ProviderMode;

  linkAccount(params: ProviderLinkParams): Promise<ProviderLinkResult>;
  getBalance(externalReference: string): Promise<ProviderBalance>;
  transfer(params: ProviderTransferParams): Promise<ProviderTransferResult>;
  receive(params: ProviderTransferParams): Promise<ProviderTransferResult>;
  getTransactionStatus(providerTransactionId: string): Promise<ProviderTransferResult>;
  cancelTransaction(providerTransactionId: string): Promise<ProviderCancelResult>;
  refund(providerTransactionId: string, amount?: number): Promise<ProviderRefundResult>;
  verifyAndParseWebhook(payload: string, signature: string | null): Promise<ProviderWebhookVerification>;
  healthCheck(): Promise<ProviderHealth>;
}
