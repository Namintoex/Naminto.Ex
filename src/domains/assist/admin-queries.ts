import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/domains/identity/security-events";
import type { Database, TicketStatus } from "@/lib/supabase/database.types";

type TicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];

const PAGE_SIZE = 25;

export interface AdminListTicketsResult {
  tickets: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Back Office — Support (Prompt 22). Ferme le workflow documenté
 * (NAMINTO.EX ARCHITECTURE GENERALE.docx, section 37-38) : Naminto
 * Assist → Diagnostic → Dossier support → **Agent humain**. Lecture
 * cross-utilisateurs, donc service_role (aucune policy select
 * cross-user sur `support_tickets`, 0013_support_tickets.sql).
 */
export async function adminListTickets(status?: TicketStatus, page = 1): Promise<AdminListTicketsResult> {
  const admin = createAdminClient();
  let query = admin.from("support_tickets").select("*", { count: "exact" });
  if (status) {
    query = query.eq("status", status);
  }

  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);
  return { tickets: data ?? [], total: count ?? 0, page: safePage, pageSize: PAGE_SIZE };
}

export type AdminUpdateTicketStatusResult = { ok: true } | { ok: false; error: string };

const NEXT_STATUS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["resolved", "closed"],
  resolved: ["closed", "in_progress"],
  closed: ["open"],
};

/**
 * Back Office — Support (Prompt 22). L'« Agent humain » du workflow
 * Naminto Assist → Diagnostic → Dossier support → Agent humain. Une
 * simple transition de statut, journalisée sur le compte du titulaire
 * du ticket. Séparée de admin-actions.ts ("use server") pour rester
 * testable directement (revalidatePath ne s'exécute pas hors du
 * runtime Next.js).
 */
export async function adminUpdateTicketStatus(ticketId: string, next: TicketStatus): Promise<AdminUpdateTicketStatusResult> {
  const admin = createAdminClient();
  const { data: ticket } = await admin.from("support_tickets").select("status, user_id").eq("id", ticketId).maybeSingle();
  if (!ticket) return { ok: false, error: "admin.support.error.notFound" };

  if (!NEXT_STATUS[ticket.status].includes(next)) {
    return { ok: false, error: "admin.support.error.invalidTransition" };
  }

  const { error } = await admin.from("support_tickets").update({ status: next }).eq("id", ticketId);
  if (error) return { ok: false, error: "admin.support.error.updateFailed" };

  await logSecurityEvent({
    userId: ticket.user_id,
    type: "support_ticket_status_changed",
    metadata: { ticketId, from: ticket.status, to: next },
  });

  return { ok: true };
}
