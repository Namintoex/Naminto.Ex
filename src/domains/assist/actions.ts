"use server";

import { createClient } from "@/lib/supabase/server";
import { getTransactionByReference } from "@/domains/payments/history";
import { getAssistResponse } from "./respond";
import { createSupportTicket } from "./create-ticket";
import type { AssistResponse, CreateTicketFormInput } from "./types";

export type AssistMessageResult = { ok: true; response: AssistResponse } | { ok: false; errorKey: string };

export async function sendAssistMessageAction(message: string): Promise<AssistMessageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  const trimmed = message.trim().slice(0, 500);
  const response = await getAssistResponse(trimmed, user.id);
  return { ok: true, response };
}

export type CreateTicketActionResult = { ok: true; id: string } | { ok: false; errorKey: string };

export async function createTicketAction(input: CreateTicketFormInput): Promise<CreateTicketActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errorKey: "session.error.expired" };

  const subject = input.subject.trim().slice(0, 140);
  const description = input.description.trim().slice(0, 2000);
  if (!subject || !description) {
    return { ok: false, errorKey: "assist.ticket.error.required" };
  }

  let relatedTransactionId: string | null = null;
  if (input.relatedTransactionReference) {
    const transaction = await getTransactionByReference(input.relatedTransactionReference);
    // Ne relie que si le titulaire est bien participant — même garde que
    // getTransactionByReference (RLS), en défense en profondeur : un
    // ticket ne doit jamais pouvoir référencer la transaction d'un tiers.
    if (transaction && (transaction.sender_user_id === user.id || transaction.recipient_user_id === user.id)) {
      relatedTransactionId = transaction.id;
    }
  }

  try {
    const ticket = await createSupportTicket({
      userId: user.id,
      subject,
      description,
      category: input.category,
      relatedTransactionId,
    });
    return { ok: true, id: ticket.id };
  } catch {
    return { ok: false, errorKey: "assist.ticket.error.failed" };
  }
}
