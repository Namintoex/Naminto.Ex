import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Locale } from "@/lib/supabase/database.types";

export type FaqEntryRow = Database["public"]["Tables"]["faq_entries"]["Row"];

/** Lecture publique — `faq_entries_select_active` (0014_back_office.sql) ne renvoie que les entrées actives. */
export async function listFaqEntries(locale: Locale): Promise<FaqEntryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faq_entries")
    .select("*")
    .eq("locale", locale)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** Back Office — voit aussi les entrées inactives (brouillons), donc service_role. */
export async function adminListFaqEntries(): Promise<FaqEntryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("faq_entries")
    .select("*")
    .order("locale", { ascending: true })
    .order("sort_order", { ascending: true });
  return data ?? [];
}
