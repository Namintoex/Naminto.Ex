import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getLinkedAccounts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("linked_accounts")
    .select(
      "id, provider, external_reference, status, capabilities, consent_status, linked_at, last_synced_at, unlinked_at"
    )
    .eq("user_id", userId)
    .neq("status", "unlinked")
    .order("linked_at", { ascending: false });
  return data ?? [];
}
