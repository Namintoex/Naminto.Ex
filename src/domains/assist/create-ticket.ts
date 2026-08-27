import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketCategory } from "./types";

export interface CreateTicketInput {
  userId: string;
  subject: string;
  description: string;
  category?: TicketCategory;
  relatedTransactionId?: string | null;
}

export interface CreateTicketResult {
  id: string;
}

/**
 * « Créer un ticket » (Prompt 21) — le « Dossier support » du workflow
 * Naminto Assist → Diagnostic → Dossier support → Agent humain
 * (NAMINTO.EX ARCHITECTURE GENERALE.docx, section 37-38). service_role,
 * même choix que les autres écritures de ce dépôt (createMoneyRequest,
 * createTransaction…) — aucune policy insert cliente sur
 * `support_tickets` (0013_support_tickets.sql). `input.userId` est déjà
 * celui de la session authentifiée côté appelant (actions.ts), jamais
 * une valeur fournie par le client.
 */
export async function createSupportTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_tickets")
    .insert({
      user_id: input.userId,
      subject: input.subject,
      description: input.description,
      category: input.category ?? "other",
      related_transaction_id: input.relatedTransactionId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Création du dossier support échouée: ${error?.message}`);
  }

  return { id: data.id };
}
