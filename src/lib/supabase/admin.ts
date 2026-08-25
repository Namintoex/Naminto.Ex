import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Client Supabase privilégié (service_role) — contourne le Row Level
 * Security. Réservé aux opérations serveur de confiance (Back Office,
 * jobs). Le paquet `server-only` fait échouer le build si ce module est
 * importé, même transitivement, depuis du code client.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
