import type { TransactionStatus } from "@/domains/payments/transaction-status";
import type { TicketCategory, TicketStatus } from "@/lib/supabase/database.types";

export type { TicketCategory, TicketStatus };

/**
 * Naminto Assist (Prompt 21) — moteur d'intentions déterministe, pas un
 * LLM : aucun fournisseur d'IA n'est connecté dans ce dépôt (aucune clé,
 * aucun SDK), et en simuler un serait une fausse intégration au sens du
 * Master Prompt (même principe que PUSH/SMS, Prompt 20). L'expérience
 * reste conversationnelle ; la résolution est un pattern-matching
 * honnête sur des données réelles (Fee Engine, statuts, historique),
 * pas une compréhension du langage naturel. Voir docs/DECISIONS.md
 * ADR-049.
 */
export type AssistIntent =
  | "sensitive_request"
  | "explain_fees"
  | "explain_status"
  | "diagnose_transaction"
  | "search_transaction"
  | "guide"
  | "create_ticket"
  | "menu"
  | "unknown";

export type GuideTopic = "send" | "receive" | "request" | "accounts" | "qr" | "security";

export interface DetectedIntent {
  intent: AssistIntent;
  /** sensitive_request : pourquoi le message a été bloqué. */
  sensitiveReason?: "secret" | "transfer_attempt";
  /** diagnose_transaction : référence détectée (NEX-XXXXXXXX). */
  reference?: string;
  /** explain_fees : montant détecté dans le message, s'il y en a un. */
  amount?: number;
  /** explain_status : statut précis reconnu dans le message. */
  status?: TransactionStatus;
  /** guide : thème reconnu. */
  topic?: GuideTopic;
}

export interface SuggestedAction {
  labelKey: string;
  href: string;
}

export interface TransactionSummary {
  reference: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
}

/**
 * Réponse de Naminto Assist — délibérément des données structurées,
 * jamais un texte pré-rendu côté serveur : la locale active est un
 * choix purement client (locale-provider.tsx, stocké en localStorage,
 * indépendant de identity_profiles.preferred_language). La composition
 * du message revient donc entièrement à assist-view.tsx, comme pour le
 * reste de l'application.
 */
export interface AssistResponse {
  intent: AssistIntent;
  sensitiveReason?: "secret" | "transfer_attempt";
  fee?: { amount: number; fee: number; currency: string } | null;
  status?: TransactionStatus;
  diagnosis?: {
    reference: string;
    status: TransactionStatus;
    amount: number;
    currency: string;
    /** OrchestratorErrorCode si l'échec vient de l'orchestrateur, sinon null. */
    reasonCode: string | null;
  } | null;
  recentTransactions?: TransactionSummary[];
  topic?: GuideTopic;
  ticket?: { id: string };
  suggestedActions?: SuggestedAction[];
  /** true : l'UI doit proposer le formulaire de création de ticket. */
  offerTicket?: boolean;
}

export interface CreateTicketFormInput {
  subject: string;
  description: string;
  category?: TicketCategory;
  relatedTransactionReference?: string;
}
