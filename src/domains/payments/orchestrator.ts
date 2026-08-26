import "server-only";
import { createTransaction, transitionTransaction } from "./transactions";
import { isInFlight, type TransactionStatus } from "./transaction-status";
import { OrchestratorError, type OrchestratorErrorCode } from "./orchestrator-errors";
import { validateRequest } from "./orchestrator-steps/validate";
import { authenticateRequest } from "./orchestrator-steps/authenticate";
import { checkRisk } from "./orchestrator-steps/risk";
import { checkFraud } from "./orchestrator-steps/fraud";
import { checkCompliance } from "./orchestrator-steps/compliance";
import { checkLimits } from "./orchestrator-steps/limits";
import { calculateFee as calculateFeeStep } from "./orchestrator-steps/fee";
import { routeRequest } from "./orchestrator-steps/routing";
import { executeProviderTransfer } from "./orchestrator-steps/execute-provider";
import { writeLedgerEntries } from "./orchestrator-steps/ledger";
import { notifyTransactionSettled } from "./orchestrator-steps/notification";
import { scheduleReconciliation } from "./orchestrator-steps/reconciliation";
import type { PaymentRequest, ResolvedRoute } from "./orchestrator-steps/types";
import type { Database } from "@/lib/supabase/database.types";

export type { PaymentRequest } from "./orchestrator-steps/types";
export { OrchestratorError } from "./orchestrator-errors";
export type { OrchestratorErrorCode } from "./orchestrator-errors";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export interface OrchestratorResult {
  transaction: Transaction;
  /** true si une transaction terminale existait déjà pour cette
   *  idempotencyKey — aucune étape à effet de bord n'a été rejouée. */
  replayed: boolean;
}

/**
 * Statut cible en cas d'erreur, en fonction de la phase où l'erreur
 * survient — doit toujours correspondre à une transition autorisée par
 * la State Machine (transaction-status.ts), sous peine d'échec du
 * trigger de défense en profondeur côté base.
 */
function failureStatusFor(phase: "validating" | "authentication_required" | "processing"): TransactionStatus {
  if (phase === "validating") return "rejected";
  if (phase === "authentication_required") return "cancelled";
  return "failed";
}

async function safeTransition(
  transactionId: string,
  to: TransactionStatus,
  reason?: string
): Promise<Transaction | null> {
  try {
    return await transitionTransaction(transactionId, to, reason);
  } catch {
    // La transaction est peut-être déjà dans un état terminal (ex. deux
    // échecs concurrents), ou l'échec est survenu entre deux transitions
    // adjacentes pour lesquelles aucun état d'échec n'est directement
    // atteignable — cas résiduel, non couvert pour l'instant (voir
    // docs/DECISIONS.md). Ne jamais faire planter la gestion d'erreur
    // elle-même pour une transition de nettoyage.
    return null;
  }
}

/**
 * Payment Orchestrator (Prompt 09/10). Flux : Request → Validation →
 * Routing → Fee → Transaction (créée) → Authentication → Risk →
 * Compliance → Limits → Provider Gateway → Ledger → Notification →
 * Reconciliation. Routing et Fee sont résolus avant la création de la
 * transaction (Fee Engine, Prompt 10, a besoin de `provider` comme
 * dimension de correspondance — voir docs/DECISIONS.md ADR-029/033).
 * Chaque étape est un module indépendant (orchestrator-steps/*),
 * remplaçable individuellement sans toucher ce fichier.
 *
 * Retries sûrs : idempotencyKey identique ⇒ createTransaction renvoie la
 * transaction existante ; si elle est déjà dans un état terminal, aucune
 * étape à effet de bord (PIN, fournisseur…) n'est rejouée.
 */
export async function runPaymentOrchestrator(request: PaymentRequest): Promise<OrchestratorResult> {
  // 1. Validation structurelle — avant toute écriture.
  try {
    validateRequest(request);
  } catch (err) {
    if (err instanceof OrchestratorError) throw err;
    throw new OrchestratorError("SYSTEM_ERROR", `Validation: ${(err as Error).message}`);
  }

  // Routing est résolu avant la création de la transaction : le Fee
  // Engine (Prompt 10) a besoin de `provider` comme dimension de
  // correspondance, et le diagramme du Prompt 09 place de toute façon
  // "Transaction" après "Provider Gateway" — seule la création de
  // l'enregistrement (nécessaire dès maintenant pour l'idempotence et le
  // suivi d'état, Prompt 08) est avancée. Routing est pur en lecture,
  // sans effet de bord, donc l'avancer ne change aucun résultat.
  let route: ResolvedRoute;
  try {
    route = await routeRequest(request);
  } catch (err) {
    if (err instanceof OrchestratorError) throw err;
    throw new OrchestratorError("SYSTEM_ERROR", `Routing: ${(err as Error).message}`);
  }

  const { fee, feePayer } = await calculateFeeStep(request, route);

  // 2. Création idempotente de la transaction.
  let transaction: Transaction;
  try {
    transaction = (await createTransaction({
      senderUserId: request.senderUserId,
      recipientUserId: request.recipientUserId,
      sourceType: request.sourceType,
      sourceReference: request.sourceLinkedAccountId,
      destinationType: request.destinationType,
      destinationReference:
        request.destinationType === "linked_account" ? request.destinationLinkedAccountId : null,
      destinationExternalReference:
        request.destinationType === "external" ? request.destinationExternalReference : null,
      provider: route.provider,
      amount: request.amount,
      currency: request.currency,
      fee,
      feePayer,
      idempotencyKey: request.idempotencyKey,
    })) as Transaction;
  } catch (err) {
    throw new OrchestratorError("SYSTEM_ERROR", `Création de transaction échouée: ${(err as Error).message}`);
  }

  if (!isInFlight(transaction.status)) {
    return { transaction, replayed: true };
  }

  try {
    // Request → Validation
    transaction = (await transitionTransaction(transaction.id, "validating")) as Transaction;
    transaction = (await transitionTransaction(transaction.id, "authentication_required")) as Transaction;

    // → Authentication
    await authenticateRequest(request);
    transaction = (await transitionTransaction(transaction.id, "authenticated")) as Transaction;
    transaction = (await transitionTransaction(transaction.id, "processing")) as Transaction;

    // → Risk → Compliance → Limits → Fraud (Fee et Routing déjà résolus
    // ci-dessus). Compliance et Limits sont des portes déterministes
    // (seuil KYC fixe, plafonds configurés) : elles passent en premier,
    // avant l'analyse de fraude combinatoire — voir docs/DECISIONS.md
    // ADR-046 (une transaction volumineuse d'un compte neuf déclenchait
    // sinon presque systématiquement une revue manuelle avant même que
    // Compliance n'ait l'occasion de statuer, y compris pour un compte
    // par ailleurs parfaitement légitime).
    const riskDecision = await checkRisk(request);
    if (riskDecision.level === "HIGH") {
      throw new OrchestratorError(
        "RISK_REJECTION",
        `Risque élevé : ${riskDecision.reasons.map((r) => r.reason).join("; ")}`,
        { reasons: riskDecision.reasons }
      );
    }

    await checkCompliance(request);
    await checkLimits(request, route);

    const fraudDecision = await checkFraud(request, riskDecision);
    if (fraudDecision.action === "BLOCK") {
      throw new OrchestratorError(
        "FRAUD_BLOCKED",
        `Bloquée par une règle anti-fraude : ${fraudDecision.matchedRules.map((r) => r.description).join("; ")}`,
        { matchedRules: fraudDecision.matchedRules }
      );
    }
    if (fraudDecision.action === "MANUAL_REVIEW") {
      throw new OrchestratorError(
        "MANUAL_REVIEW_REQUIRED",
        `Revue manuelle requise : ${fraudDecision.matchedRules.map((r) => r.description).join("; ")}`,
        { matchedRules: fraudDecision.matchedRules }
      );
    }
    // STEP_UP : aucune authentification supplémentaire n'est disponible
    // dans ce dépôt (biométrie/WebAuthn non implémentées — voir
    // docs/DECISIONS.md, TODO_DECISION Identity). Même traitement que
    // le step-up déjà documenté pour un nouvel appareil à la connexion
    // (Prompt 04) : journalisé (checkFraud l'a déjà fait), jamais
    // bloquant faute de second facteur réel à proposer.

    // → Provider Gateway (ignoré si virement portefeuille à portefeuille pur)
    let providerTransactionId: string | null = null;
    if (route.provider) {
      const result = await executeProviderTransfer(request, route, fee);
      providerTransactionId = result.providerTransactionId;
    }

    transaction = (await transitionTransaction(
      transaction.id,
      "provider_confirmed",
      undefined,
      { providerTransactionId }
    )) as Transaction;

    // → Ledger
    await writeLedgerEntries(transaction.id);

    transaction = (await transitionTransaction(transaction.id, "settled")) as Transaction;

    // → Notification → Reconciliation
    await notifyTransactionSettled(transaction.id);
    await scheduleReconciliation(transaction.id);

    return { transaction, replayed: false };
  } catch (err) {
    const orchestratorError =
      err instanceof OrchestratorError
        ? err
        : new OrchestratorError("SYSTEM_ERROR", (err as Error).message ?? "Erreur inconnue");

    // TIMEOUT converge toujours vers "expired", quelle que soit la phase
    // (transition valide depuis authentication_required ET processing).
    const phase = phaseForStatus(transaction.status);
    const targetStatus: TransactionStatus =
      orchestratorError.code === "TIMEOUT" ? "expired" : failureStatusFor(phase);

    await safeTransition(transaction.id, targetStatus, `${orchestratorError.code}: ${orchestratorError.message}`);

    throw orchestratorError;
  }
}

function phaseForStatus(status: TransactionStatus): "validating" | "authentication_required" | "processing" {
  if (status === "created" || status === "validating") return "validating";
  if (status === "authentication_required") return "authentication_required";
  return "processing";
}

export function classifyError(err: unknown): OrchestratorErrorCode {
  if (err instanceof OrchestratorError) return err.code;
  return "SYSTEM_ERROR";
}
