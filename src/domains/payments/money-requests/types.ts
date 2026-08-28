import type { Database, MoneyRequestStatus } from "@/lib/supabase/database.types";

export type { MoneyRequestStatus };
export type MoneyRequestRow = Database["public"]["Tables"]["money_requests"]["Row"];

/**
 * Forme minimale exposée à la page publique `/pay/[token]` (revue de
 * code) — jamais `requester_user_id`/`claimed_by_user_id`/
 * `fulfilled_transaction_id`/`id` : `MoneyRequestRow` complet passé tel
 * quel en prop à un composant client sérialise tout dans le payload RSC
 * envoyé au navigateur, y compris à un visiteur qui n'est pas le payeur
 * prévu (le lien n'est protégé que par la session Naminto.Ex, pas par
 * l'identité). Même principe déjà appliqué à `AdminTransactionSummary`
 * (Prompt 28, ADR-056).
 */
export type PublicMoneyRequestView = Pick<MoneyRequestRow, "token" | "amount" | "currency" | "note" | "status" | "expires_at">;

/**
 * Durée de vie par défaut d'une demande d'argent — non documentée dans
 * les sources du projet (Prompt 14 exige seulement qu'un identifiant
 * « expirant » existe). Valeur raisonnable choisie par implémentation ;
 * voir docs/DECISIONS.md ADR-042 (TODO_DECISION si une autre durée est
 * souhaitée).
 */
export const MONEY_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MoneyRequestNotFoundError extends Error {
  constructor(token: string) {
    super(`Demande d'argent introuvable : ${token}`);
    this.name = "MoneyRequestNotFoundError";
  }
}

export class MoneyRequestNotPendingError extends Error {
  constructor(status: MoneyRequestStatus) {
    super(`Cette demande n'est plus modifiable (statut effectif : ${status})`);
    this.name = "MoneyRequestNotPendingError";
  }
}

export class MoneyRequestForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyRequestForbiddenError";
  }
}

/**
 * Statut effectif d'une demande — dérivé de `expires_at` plutôt que
 * physiquement écrit en base par une tâche planifiée (hors périmètre de
 * ce prompt). Une demande stockée `pending` mais dont l'échéance est
 * dépassée est traitée comme `expired` partout où ce statut est utilisé.
 */
export function effectiveStatus(row: Pick<MoneyRequestRow, "status" | "expires_at">): MoneyRequestStatus {
  if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return row.status;
}
