import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provider } from "@/lib/supabase/database.types";
import { getProviderAdapter, listRegisteredProviders } from "./registry";
import type { ProviderHealth, ProviderMode } from "./types";

export interface AdminProviderSummary {
  provider: Provider;
  mode: ProviderMode;
  health: ProviderHealth;
  transactionCount: number;
}

/**
 * Back Office — Providers (Prompt 22). Réutilise le Provider Registry
 * tel quel (Prompt 07) — jamais un nouvel adapter ni un état de santé
 * réinventé. `healthCheck()` existe déjà sur chaque adapter ; le seul
 * ajout ici est un comptage réel de transactions par fournisseur, pour
 * donner un signal d'usage au-delà du mode statique (SANDBOX partout
 * tant qu'aucun fournisseur réel n'est connecté).
 */
export async function adminListProviders(): Promise<AdminProviderSummary[]> {
  const admin = createAdminClient();
  const providers = listRegisteredProviders();

  return Promise.all(
    providers.map(async (provider) => {
      const adapter = getProviderAdapter(provider);
      const [health, { count }] = await Promise.all([
        adapter.healthCheck(),
        admin.from("transactions").select("id", { count: "exact", head: true }).eq("provider", provider),
      ]);
      return { provider, mode: adapter.mode, health, transactionCount: count ?? 0 };
    })
  );
}
