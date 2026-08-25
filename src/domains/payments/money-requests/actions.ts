"use server";

import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/domains/identity/security-events";
import { OrchestratorError } from "@/domains/payments/orchestrator";
import { cancelMoneyRequest } from "./cancel";
import { createMoneyRequest } from "./create";
import { fulfillMoneyRequest } from "./fulfill";
import {
  MoneyRequestForbiddenError,
  MoneyRequestNotFoundError,
  MoneyRequestNotPendingError,
} from "./types";

export interface CreateMoneyRequestInput {
  amount: number;
  note?: string;
}

export type CreateMoneyRequestActionResult =
  | { ok: true; id: string; token: string }
  | { ok: false; errorKey: string };

export async function createMoneyRequestAction(
  input: CreateMoneyRequestInput
): Promise<CreateMoneyRequestActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, errorKey: "request.error.amountInvalid" };
  }
  const note = input.note?.trim().slice(0, 140) || null;

  const request = await createMoneyRequest({ requesterUserId: user.id, amount: input.amount, note });

  await logSecurityEvent({
    userId: user.id,
    type: "money_request_created",
    metadata: { requestId: request.id, amount: input.amount },
  });

  return { ok: true, id: request.id, token: request.token };
}

export type CancelMoneyRequestActionResult = { ok: true } | { ok: false; errorKey: string };

export async function cancelMoneyRequestAction(requestId: string): Promise<CancelMoneyRequestActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  try {
    await cancelMoneyRequest(requestId, user.id);
  } catch (err) {
    if (err instanceof MoneyRequestNotFoundError) return { ok: false, errorKey: "request.error.notFound" };
    if (err instanceof MoneyRequestForbiddenError) return { ok: false, errorKey: "request.error.forbidden" };
    if (err instanceof MoneyRequestNotPendingError) return { ok: false, errorKey: "request.error.notPending" };
    return { ok: false, errorKey: "request.error.cancelFailed" };
  }

  await logSecurityEvent({ userId: user.id, type: "money_request_cancelled", metadata: { requestId } });
  return { ok: true };
}

export interface PayMoneyRequestInput {
  token: string;
  pin: string;
}

export type PayMoneyRequestResult =
  | { ok: true; transactionId: string; reference: string }
  | { ok: false; errorKey: string };

const AUTH_ERROR_REASON_KEYS: Record<string, string> = {
  not_set: "pin.error.notSet",
  locked: "pin.error.locked",
  invalid: "pin.error.invalid",
};

/**
 * Étape « Exécution » du règlement d'une demande — délègue entièrement à
 * `fulfillMoneyRequest`, elle-même entièrement déléguée au Payment
 * Orchestrator. Mêmes codes d'erreur que Send Money (Prompt 13) pour ne
 * pas dupliquer la classification.
 */
export async function payMoneyRequestAction(input: PayMoneyRequestInput): Promise<PayMoneyRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  try {
    const result = await fulfillMoneyRequest({ token: input.token, payerUserId: user.id, pin: input.pin });
    return { ok: true, transactionId: result.transactionId, reference: result.reference };
  } catch (err) {
    if (err instanceof MoneyRequestNotFoundError) return { ok: false, errorKey: "pay.error.notFound" };
    if (err instanceof MoneyRequestForbiddenError) return { ok: false, errorKey: "pay.error.self" };
    if (err instanceof MoneyRequestNotPendingError) return { ok: false, errorKey: "pay.error.notPending" };
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
