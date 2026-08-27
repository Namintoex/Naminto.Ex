import type { ReconciliationAnomalyStatus, ReconciliationAnomalyType } from "@/lib/supabase/database.types";

export type { ReconciliationAnomalyStatus, ReconciliationAnomalyType };

/**
 * Reconciliation Engine (Prompt 24) — compare trois vues d'une même
 * transaction : NAMINTO LEDGER (ledger_entries, notre comptabilité
 * interne), PROVIDER (Provider Gateway, Prompt 07 — `null` si aucun
 * fournisseur externe n'est impliqué, ex. wallet-à-wallet), SETTLEMENT
 * (transactions, ce que nous croyons nous-mêmes avoir réglé). Cinq
 * types d'anomalie, chacun comparant une paire précise — voir
 * docs/DECISIONS.md ADR-052 pour la justification de cette
 * interprétation (le prompt nomme les trois vues et les cinq types,
 * jamais quelle paire chaque type compare).
 */
export interface LedgerView {
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  entries: { accountId: string; direction: "debit" | "credit"; amount: number }[];
}

export interface ProviderView {
  checked: boolean;
  providerTransactionId: string | null;
  status: "pending" | "confirmed" | "failed" | "unknown" | null;
  reason?: string;
}

export interface SettlementView {
  status: string;
  amount: number;
  fee: number;
  total: number;
  feePayer: string;
  expectedSenderDebit: number;
}

export interface AnomalyDetails {
  ledger: LedgerView;
  provider: ProviderView;
  settlement: SettlementView;
  note?: string;
}

export interface DetectedAnomaly {
  type: ReconciliationAnomalyType;
  details: AnomalyDetails;
}

export interface ReconcileTransactionResult {
  transactionId: string;
  reference: string;
  anomalies: DetectedAnomaly[];
  /** Anomalies déjà ouvertes du même type pour cette transaction, jamais recréées en double. */
  skippedExisting: ReconciliationAnomalyType[];
}
