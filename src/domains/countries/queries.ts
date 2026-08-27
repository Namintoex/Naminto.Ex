import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type CountryRow = Database["public"]["Tables"]["countries"]["Row"];

/**
 * Countries (Prompt 22) — contenu de référence, pas une règle métier :
 * lecture publique (`countries_select_all`, 0014_back_office.sql).
 */
export async function listCountries(): Promise<CountryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("countries").select("*").order("name", { ascending: true });
  return data ?? [];
}
