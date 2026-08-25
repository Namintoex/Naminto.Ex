/**
 * State Machine du domaine Transaction (Prompt 08).
 * Reprend exactement la table de transitions documentée dans
 * PAYMENTS — Spécification Markdown et docs/ARCHITECTURE.md : aucune
 * transition n'est inventée ici. Toute transition hors de cette liste
 * est interdite.
 */
export type TransactionStatus =
  | "created"
  | "validating"
  | "authentication_required"
  | "authenticated"
  | "processing"
  | "provider_confirmed"
  | "settled"
  | "failed"
  | "rejected"
  | "expired"
  | "cancelled"
  | "reversed"
  | "refunded"
  | "disputed";

export const TRANSACTION_STATUSES: TransactionStatus[] = [
  "created",
  "validating",
  "authentication_required",
  "authenticated",
  "processing",
  "provider_confirmed",
  "settled",
  "failed",
  "rejected",
  "expired",
  "cancelled",
  "reversed",
  "refunded",
  "disputed",
];

/**
 * États terminaux qui ne devraient normalement plus évoluer. `disputed`
 * est volontairement sans transition sortante : la résolution d'une
 * contestation (retour vers reversed/refunded, ou autre) n'est pas
 * définie dans les documents source — TODO_DECISION, voir docs/DECISIONS.md.
 */
export const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  created: ["validating"],
  validating: ["authentication_required", "failed", "rejected"],
  authentication_required: ["authenticated", "expired", "cancelled"],
  authenticated: ["processing"],
  processing: ["provider_confirmed", "failed", "expired"],
  provider_confirmed: ["settled"],
  settled: ["reversed", "refunded", "disputed"],
  failed: [],
  rejected: [],
  expired: [],
  cancelled: [],
  reversed: [],
  refunded: [],
  disputed: [],
};

export class InvalidTransactionTransitionError extends Error {
  readonly from: TransactionStatus;
  readonly to: TransactionStatus;

  constructor(from: TransactionStatus, to: TransactionStatus) {
    super(`Transition de transaction invalide : ${from} → ${to}`);
    this.name = "InvalidTransactionTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TransactionStatus, to: TransactionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransactionTransitionError(from, to);
  }
}

export function isTerminalStatus(status: TransactionStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
