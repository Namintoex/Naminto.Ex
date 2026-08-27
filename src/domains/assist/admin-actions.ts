"use server";

import { revalidatePath } from "next/cache";
import { adminUpdateTicketStatus, type AdminUpdateTicketStatusResult } from "./admin-queries";
import type { TicketStatus } from "@/lib/supabase/database.types";

/**
 * Wrapper "use server" fin autour de `adminUpdateTicketStatus`
 * (admin-queries.ts) : la logique de transition/journalisation vit là,
 * testable directement — ici, seulement le revalidate propre à Next.js.
 */
export async function adminUpdateTicketStatusAction(
  ticketId: string,
  next: TicketStatus
): Promise<AdminUpdateTicketStatusResult> {
  const result = await adminUpdateTicketStatus(ticketId, next);
  if (result.ok) {
    revalidatePath("/admin/support");
  }
  return result;
}
