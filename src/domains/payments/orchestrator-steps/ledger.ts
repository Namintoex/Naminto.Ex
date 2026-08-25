import "server-only";
import { recordSettlement } from "@/domains/payments/ledger";
import { OrchestratorError } from "../orchestrator-errors";

/**
 * Étape 9 — Ledger (Prompt 12). Délègue entièrement au domaine Ledger :
 * aucune logique comptable ici. Idempotent — voir recordSettlement.
 */
export async function writeLedgerEntries(transactionId: string): Promise<void> {
  try {
    await recordSettlement(transactionId);
  } catch (err) {
    throw new OrchestratorError("SYSTEM_ERROR", `Ledger: ${(err as Error).message}`);
  }
}
