import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Client Supabase pour Server Components / Route Handlers / Server Actions.
 * Le `setAll` peut échouer silencieusement quand appelé depuis un Server
 * Component pur (lecture seule) — le rafraîchissement de session est alors
 * assuré par le middleware, conformément au pattern @supabase/ssr.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component — ignoré, voir middleware.ts
        }
      },
    },
  });
}
