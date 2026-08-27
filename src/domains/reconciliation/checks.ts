import type { AnomalyDetails, DetectedAnomaly, LedgerView, ProviderView, SettlementView } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const FAILURE_LIKE_STATUSES = ["failed", "rejected", "cancelled", "expired"];

/**
 * Cinq vérifications indépendantes (Prompt 24) — chacune compare une
 * paire précise parmi les trois vues (LEDGER/PROVIDER/SETTLEMENT).
 * Fonctions pures : aucune n'écrit jamais rien, `run.ts` se charge
 * seule de la persistance des anomalies détectées.
 */

/** SETTLEMENT dit réglée, mais LEDGER n'a aucune écriture : le règlement s'est perdu en route. */
export function checkMissing(settlement: SettlementView, ledger: LedgerView): DetectedAnomaly | null {
  if (settlement.status === "settled" && ledger.entryCount === 0) {
    return { type: "missing", details: buildDetails(ledger, { checked: false, providerTransactionId: null, status: null }, settlement) };
  }
  return null;
}

/** LEDGER contient plus d'une écriture pour le même (compte, sens) — un rejeu ou une double écriture. */
export function checkDuplicate(
  settlement: SettlementView,
  ledger: LedgerView,
  provider: ProviderView
): DetectedAnomaly | null {
  const counts = new Map<string, number>();
  for (const entry of ledger.entries) {
    const key = `${entry.accountId}:${entry.direction}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const hasDuplicate = [...counts.values()].some((count) => count > 1);
  if (hasDuplicate) {
    return { type: "duplicate", details: buildDetails(ledger, provider, settlement) };
  }
  return null;
}

/** LEDGER (débit réel) vs SETTLEMENT (débit attendu d'après amount/fee/fee_payer) — jamais recalculé, seulement relu. */
export function checkAmountMismatch(settlement: SettlementView, ledger: LedgerView, provider: ProviderView): DetectedAnomaly | null {
  if (settlement.status !== "settled" || ledger.entryCount === 0) return null;

  const actualDebit = round2(ledger.entries.filter((e) => e.direction === "debit").reduce((sum, e) => sum + e.amount, 0));
  if (actualDebit !== round2(settlement.expectedSenderDebit)) {
    return { type: "amount_mismatch", details: buildDetails(ledger, provider, settlement) };
  }
  return null;
}

/** SETTLEMENT (notre statut) vs PROVIDER (son statut réel) — seulement quand un fournisseur externe est impliqué. */
export function checkStatusMismatch(settlement: SettlementView, ledger: LedgerView, provider: ProviderView): DetectedAnomaly | null {
  if (!provider.checked) return null;

  const settledNotConfirmed = settlement.status === "settled" && provider.status !== "confirmed";
  const failedButConfirmed = FAILURE_LIKE_STATUSES.includes(settlement.status) && provider.status === "confirmed";
  if (settledNotConfirmed || failedButConfirmed) {
    return { type: "status_mismatch", details: buildDetails(ledger, provider, settlement) };
  }
  return null;
}

/** LEDGER seul : débits ≠ crédits pour une transaction réglée — filet de sécurité indépendant du garde-fou applicatif à l'écriture (ADR-040). */
export function checkSettlementMismatch(settlement: SettlementView, ledger: LedgerView, provider: ProviderView): DetectedAnomaly | null {
  if (settlement.status !== "settled" || ledger.entryCount === 0) return null;

  if (round2(ledger.totalDebit) !== round2(ledger.totalCredit)) {
    return { type: "settlement_mismatch", details: buildDetails(ledger, provider, settlement) };
  }
  return null;
}

function buildDetails(ledger: LedgerView, provider: ProviderView, settlement: SettlementView): AnomalyDetails {
  return { ledger, provider, settlement };
}

export const ALL_CHECKS = [checkMissing, checkDuplicate, checkAmountMismatch, checkStatusMismatch, checkSettlementMismatch];
