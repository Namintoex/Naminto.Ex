"use server";

import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getIdentityProfile } from "@/domains/identity/queries";
import { generateQrSvg } from "@/lib/qr";
import { getRequestOrigin } from "@/lib/request-origin";
import { runPaymentOrchestrator, OrchestratorError } from "@/domains/payments/orchestrator";
import { resolvePrefilledPayment } from "./resolve";
import { encodeQr, verifyQr } from "./sign";
import { PREFILLED_PAYMENT_QR_TTL_MS } from "./types";

export interface GeneratePrefilledQrInput {
  amount: number;
  note?: string;
}

export type GeneratePrefilledQrResult =
  | { ok: true; shareLink: string; qrSvg: string }
  | { ok: false; errorKey: string };

/**
 * Génère un QR PREFILLED_PAYMENT pour l'utilisateur courant comme
 * bénéficiaire — aucune ligne persistée (contrairement à Request Money,
 * Prompt 14) : tout l'état tient dans le payload signé lui-même.
 */
export async function generatePrefilledQrAction(input: GeneratePrefilledQrInput): Promise<GeneratePrefilledQrResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, errorKey: "request.error.amountInvalid" };
  }

  const profile = await getIdentityProfile(user.id);
  if (!profile) return { ok: false, errorKey: "session.error.expired" };

  const now = Date.now();
  const encoded = encodeQr({
    v: 1,
    type: "PREFILLED_PAYMENT",
    iat: now,
    exp: now + PREFILLED_PAYMENT_QR_TTL_MS,
    recipientUserId: user.id,
    recipientNamintoId: profile.naminto_id,
    amount: input.amount,
    currency: "XOF",
    note: input.note?.trim().slice(0, 140) || null,
  });

  const origin = await getRequestOrigin();
  const shareLink = `${origin}/qr/${encoded}`;
  const qrSvg = await generateQrSvg(shareLink);

  return { ok: true, shareLink, qrSvg };
}

export interface PayPrefilledQrInput {
  raw: string;
  pin: string;
}

export type PayPrefilledQrResult =
  | { ok: true; transactionId: string; reference: string }
  | { ok: false; errorKey: string };

const AUTH_ERROR_REASON_KEYS: Record<string, string> = {
  not_set: "pin.error.notSet",
  locked: "pin.error.locked",
  invalid: "pin.error.invalid",
};

/**
 * Étape « authenticate → execute » pour PREFILLED_PAYMENT — revérifie
 * la signature côté serveur (ne fait jamais confiance à un payload
 * simplement renvoyé par le client), puis délègue entièrement au
 * Payment Orchestrator. `idempotencyKey` dérivée du QR et du payeur : un
 * même payeur qui rejoue la même confirmation ne peut jamais produire
 * deux transactions, mais deux payeurs différents scannant le même QR
 * statique produisent chacun la leur.
 */
export async function payPrefilledQrAction(input: PayPrefilledQrInput): Promise<PayPrefilledQrResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  const decoded = verifyQr(input.raw);
  if (!decoded.ok) return { ok: false, errorKey: "qr.error.invalid" };
  if (decoded.payload.type !== "PREFILLED_PAYMENT") return { ok: false, errorKey: "qr.error.invalid" };

  const payload = decoded.payload;
  if (payload.recipientUserId === user.id) {
    return { ok: false, errorKey: "pay.error.self" };
  }

  const recipient = await resolvePrefilledPayment(payload);
  if (!recipient) return { ok: false, errorKey: "qr.error.recipientGone" };

  // Déterministe par (QR, payeur) : un même payeur qui rejoue la même
  // confirmation (double clic, coupure réseau après règlement) ne peut
  // jamais produire deux transactions ; un autre payeur scannant le même
  // QR statique obtient sa propre clé, donc sa propre transaction.
  const idempotencyKey = `qr-prefilled-${createHash("sha256").update(`${input.raw}:${user.id}`).digest("hex").slice(0, 40)}`;

  try {
    const { transaction } = await runPaymentOrchestrator({
      senderUserId: user.id,
      recipientUserId: payload.recipientUserId,
      sourceType: "naminto_wallet",
      sourceLinkedAccountId: null,
      destinationType: "naminto_wallet",
      destinationLinkedAccountId: null,
      destinationExternalReference: null,
      amount: payload.amount,
      currency: payload.currency,
      pin: input.pin,
      idempotencyKey,
    });
    return { ok: true, transactionId: transaction.id, reference: transaction.reference };
  } catch (err) {
    if (err instanceof OrchestratorError) {
      const reason = err.details?.reason;
      if (err.code === "AUTH_ERROR" && typeof reason === "string" && AUTH_ERROR_REASON_KEYS[reason]) {
        return { ok: false, errorKey: AUTH_ERROR_REASON_KEYS[reason] };
      }
      return { ok: false, errorKey: "send.error.system" };
    }
    return { ok: false, errorKey: "send.error.system" };
  }
}
