import type { TransactionStatus } from "../transaction-status";

export interface TransactionFilters {
  reference?: string;
  status?: TransactionStatus;
  direction?: "sent" | "received";
  /** ISO date (yyyy-mm-dd), borne inférieure incluse sur created_at. */
  from?: string;
  /** ISO date (yyyy-mm-dd), borne supérieure incluse sur created_at. */
  to?: string;
}

export type CounterpartyKind = "user" | "external" | "own_linked_account";

export interface CounterpartyInfo {
  kind: CounterpartyKind;
  label: string;
}
