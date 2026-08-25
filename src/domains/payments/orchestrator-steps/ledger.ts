import "server-only";

/**
 * Étape 9 — Ledger. STUB : le Financial Ledger réel (écritures
 * append-only, comptes, débit/crédit — Prompt 12) n'existe pas encore.
 * Cette étape reste présente dans le pipeline, avec la signature qu'elle
 * aura une fois réelle, pour que son branchement futur ne modifie pas le
 * Payment Orchestrator.
 */
export async function writeLedgerEntries(transactionId: string): Promise<void> {
  console.info("[ledger:stub] écriture différée au Prompt 12", { transactionId });
}
