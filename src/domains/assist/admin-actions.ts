"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { adminUpdateTicketStatus, type AdminUpdateTicketStatusResult } from "./admin-queries";
import type { TicketStatus } from "@/lib/supabase/database.types";

/**
 * Wrapper "use server" fin autour de `adminUpdateTicketStatus`
 * (admin-queries.ts) : la logique de transition/journalisation vit là,
 * testable directement — ici, le contrôle de permission (Prompt 23,
 * `support.manage`) puis le revalidate propre à Next.js.
 */
export async function adminUpdateTicketStatusAction(
  ticketId: string,
  next: TicketStatus
): Promise<AdminUpdateTicketStatusResult> {
  const auth = await checkPermission("support.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminUpdateTicketStatus(ticketId, next);
  if (result.ok) {
    revalidatePath("/admin/support");
  }
  return result;
}
