import type {
  LedgerAccountOwnerType,
  LedgerEntryDirection,
  LedgerEntryKind,
  Provider,
} from "@/lib/supabase/database.types";

export type { LedgerAccountOwnerType, LedgerEntryDirection, LedgerEntryKind };

/**
 * Référence logique d'un compte du grand livre — résolue en id concret
 * par `getOrCreateLedgerAccount` (ledger/accounts.ts). `ownerId`/`provider`
 * absents correspondent aux `null` de l'index unique côté base
 * (supabase/migrations/0008_ledger.sql).
 */
export interface LedgerAccountRef {
  ownerType: LedgerAccountOwnerType;
  ownerId?: string | null;
  provider?: Provider | null;
  currency: string;
}

export interface LedgerEntryInput {
  accountRef: LedgerAccountRef;
  direction: LedgerEntryDirection;
  amount: number;
  currency: string;
}

export class LedgerTransactionNotFoundError extends Error {
  constructor(transactionId: string) {
    super(`Transaction introuvable pour le Ledger : ${transactionId}`);
    this.name = "LedgerTransactionNotFoundError";
  }
}

export class LedgerImbalanceError extends Error {
  constructor(totalDebit: number, totalCredit: number) {
    super(`Écritures déséquilibrées : débits=${totalDebit}, crédits=${totalCredit}`);
    this.name = "LedgerImbalanceError";
  }
}

export class LedgerCurrencyMismatchError extends Error {
  constructor() {
    super("Toutes les écritures d'un même lot doivent partager la même devise");
    this.name = "LedgerCurrencyMismatchError";
  }
}

export class LedgerInvalidAmountError extends Error {
  constructor(amount: number) {
    super(`Montant d'écriture invalide (doit être > 0) : ${amount}`);
    this.name = "LedgerInvalidAmountError";
  }
}

export class LedgerMissingSettlementError extends Error {
  constructor(transactionId: string) {
    super(`Aucune écriture de règlement (settlement) trouvée pour la transaction ${transactionId} — reversal/refund impossible`);
    this.name = "LedgerMissingSettlementError";
  }
}
