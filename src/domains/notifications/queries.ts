import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

const PAGE_SIZE = 30;

/**
 * Historique de notifications (Prompt 20) — passe par le client RLS
 * (`notifications_select_own`) plutôt que service_role : la policy fait
 * déjà exactement le filtrage nécessaire, même choix que
 * `payments/history/queries.ts` (ADR déjà établi pour ce type de lecture).
 */
export async function getNotificationHistory(userId: string): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  return data ?? [];
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

/**
 * Marque une notification comme lue — la policy `notifications_update_own`
 * garantit déjà qu'un titulaire ne peut modifier que sa propre ligne ;
 * `.eq("user_id", userId)` reste une défense en profondeur explicite,
 * pas une nécessité stricte.
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId);
}
