"use server";

import { createClient } from "@/lib/supabase/server";
import { findRecipientByNamintoId } from "@/domains/identity/queries";
import { getOrCreateDeviceCookie } from "@/domains/identity/devices";
import { calculateFee } from "@/domains/payments/fee-engine";
import { runPaymentOrchestrator, OrchestratorError } from "@/domains/payments/orchestrator";
import type { PaymentRequest } from "@/domains/payments/orchestrator-steps/types";
import type { DestinationType, FeePayer, Provider, SourceType } from "@/lib/supabase/database.types";

/**
 * Actions serveur de Send Money (Prompt 13). L'assistant Naminto.Ex
 * (Prompt 21) ne pourra jamais appeler `sendMoneyAction` directement à la
 * place de l'utilisateur — seule cette action, invoquée depuis l'étape de
 * confirmation explicite du parcours, déclenche une opération financière.
 */

export interface RecipientLookupResult {
  found: boolean;
  recipientUserId?: string;
  namintoId?: string;
  legalName?: string;
}

/**
 * Étape « Vérification » du bénéficiaire — résout un identifiant
 * Naminto.Ex saisi par l'expéditeur en un nom affichable, avant tout
 * engagement de montant. Exclut le compte de l'expéditeur lui-même
 * (aucune règle documentée sur l'auto-paiement interne autrement que via
 * la validation déjà appliquée par l'orchestrateur, mais autant ne pas
 * laisser l'UI le proposer comme un résultat valide).
 */
export async function lookupRecipientAction(rawNamintoId: string): Promise<RecipientLookupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { found: false };

  const namintoId = rawNamintoId.trim().toLowerCase();
  if (!namintoId) return { found: false };

  const recipient = await findRecipientByNamintoId(namintoId);
  if (!recipient || recipient.userId === user.id) {
    return { found: false };
  }

  return {
    found: true,
    recipientUserId: recipient.userId,
    namintoId: recipient.namintoId,
    legalName: recipient.legalName,
  };
}

export interface FeePreviewInput {
  amount: number;
  sourceType: SourceType;
  destinationType: DestinationType;
  provider: Provider | null;
  feePayer: FeePayer;
}

export type FeePreviewResult =
  | { ok: true; fee: number; senderDebit: number; recipientCredit: number }
  | { ok: false };

/**
 * Étape « Frais » — aperçu avant confirmation. Délègue entièrement au
 * Fee Engine (Prompt 10, `calculateFee`) : aucune règle tarifaire
 * dupliquée ici. Le calcul définitif, effectué par le Payment
 * Orchestrator au moment de l'exécution réelle, utilise exactement la
 * même fonction — cet aperçu ne peut donc pas diverger du montant
 * réellement débité.
 */
export async function previewFeeAction(input: FeePreviewInput): Promise<FeePreviewResult> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false };
  }
  try {
    const result = await calculateFee({
      amount: input.amount,
      currency: "XOF",
      sourceType: input.sourceType,
      destinationType: input.destinationType,
      provider: input.provider,
      transactionType: "send",
      feePayerOverride: input.feePayer,
    });
    return { ok: true, fee: result.fee, senderDebit: result.senderDebit, recipientCredit: result.recipientCredit };
  } catch {
    return { ok: false };
  }
}

export type SendMoneyRecipient =
  | { mode: "internal"; recipientUserId: string }
  | { mode: "external"; sourceLinkedAccountId: string; destinationReference: string };

export interface SendMoneyInput {
  /** Généré une seule fois côté client à l'entrée du récapitulatif —
   *  garantit qu'un double clic ou un rejeu après coupure réseau ne
   *  produit jamais deux transactions (Master Prompt, section 6). */
  idempotencyKey: string;
  amount: number;
  feePayer: FeePayer;
  pin: string;
  recipient: SendMoneyRecipient;
}

export type SendMoneyResult =
  | { ok: true; transactionId: string; reference: string; status: string; fee: number; total: number }
  | { ok: false; code: string; errorKey: string };

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  VALIDATION_ERROR: "send.error.validation",
  AUTH_ERROR: "send.error.auth",
  RISK_REJECTION: "send.error.risk",
  COMPLIANCE_REJECTION: "send.error.compliance",
  LIMIT_ERROR: "send.error.limit",
  PROVIDER_ERROR: "send.error.provider",
  TIMEOUT: "send.error.timeout",
  SYSTEM_ERROR: "send.error.system",
};

const AUTH_ERROR_REASON_KEYS: Record<string, string> = {
  not_set: "pin.error.notSet",
  locked: "pin.error.locked",
  invalid: "pin.error.invalid",
};

/**
 * Étape « Exécution » — construit la `PaymentRequest` à partir du choix
 * de bénéficiaire déjà vérifié et délègue entièrement au Payment
 * Orchestrator (Prompt 09-12). Aucune règle financière ici : Risk,
 * Compliance, Limits, Fee, Ledger sont tous appliqués par l'orchestrateur
 * lui-même.
 */
export async function sendMoneyAction(input: SendMoneyInput): Promise<SendMoneyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, code: "SYSTEM_ERROR", errorKey: "session.error.expired" };
  }

  const base = {
    senderUserId: user.id,
    amount: input.amount,
    currency: "XOF",
    pin: input.pin,
    feePayerOverride: input.feePayer,
    idempotencyKey: input.idempotencyKey,
    deviceFingerprint: await getOrCreateDeviceCookie(),
  };

  const request: PaymentRequest =
    input.recipient.mode === "internal"
      ? {
          ...base,
          recipientUserId: input.recipient.recipientUserId,
          sourceType: "naminto_wallet",
          sourceLinkedAccountId: null,
          destinationType: "naminto_wallet",
          destinationLinkedAccountId: null,
          destinationExternalReference: null,
        }
      : {
          ...base,
          recipientUserId: null,
          sourceType: "linked_account",
          sourceLinkedAccountId: input.recipient.sourceLinkedAccountId,
          destinationType: "external",
          destinationLinkedAccountId: null,
          destinationExternalReference: input.recipient.destinationReference,
        };

  try {
    const { transaction } = await runPaymentOrchestrator(request);
    return {
      ok: true,
      transactionId: transaction.id,
      reference: transaction.reference,
      status: transaction.status,
      fee: Number(transaction.fee),
      total: Number(transaction.total),
    };
  } catch (err) {
    if (err instanceof OrchestratorError) {
      const reason = err.details?.reason;
      if (err.code === "AUTH_ERROR" && typeof reason === "string" && AUTH_ERROR_REASON_KEYS[reason]) {
        return { ok: false, code: err.code, errorKey: AUTH_ERROR_REASON_KEYS[reason] };
      }
      return { ok: false, code: err.code, errorKey: ERROR_MESSAGE_KEYS[err.code] ?? "send.error.system" };
    }
    return { ok: false, code: "SYSTEM_ERROR", errorKey: "send.error.system" };
  }
}
