import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Provider } from "@/lib/supabase/database.types";

/**
 * Statuts qui ne représentent jamais un usage réel (l'opération n'a
 * jamais abouti ni n'est en cours) — exclus du calcul d'usage courant.
 * Tout le reste (y compris les statuts en cours et `settled`) compte,
 * de façon volontairement conservatrice : mieux vaut sous-estimer la
 * marge disponible que sous-estimer l'usage réel.
 */
const EXCLUDED_STATUSES = ["failed", "rejected", "cancelled", "expired"];

function periodStart(days: number): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  if (days > 1) {
    start.setUTCDate(1); // début du mois calendaire courant pour les limites mensuelles
  }
  return start.toISOString();
}

/**
 * Somme des montants envoyés par l'utilisateur depuis le début de la
 * période calendaire courante (jour ou mois, en UTC). `provider` doit
 * être celui de la règle effectivement retenue (`pickRuleForType`) —
 * quand cette règle est spécialisée sur un fournisseur (revue de code :
 * bug trouvé où l'usage était toujours agrégé tous fournisseurs
 * confondus, même pour une règle `provider`-spécifique, sous-comptant ou
 * sur-comptant selon les fournisseurs déjà utilisés ce jour-là), seules
 * les transactions de ce fournisseur doivent compter dans le cumul que
 * cette règle contraint. `null`/absent = pas de filtre, comme avant.
 */
export async function getAmountUsage(
  userId: string,
  currency: string,
  period: "day" | "month",
  provider?: Provider | null
): Promise<number> {
  const admin = createAdminClient();
  const since = periodStart(period === "month" ? 31 : 1);

  let query = admin
    .from("transactions")
    .select("amount")
    .eq("sender_user_id", userId)
    .eq("currency", currency)
    .not("status", "in", `(${EXCLUDED_STATUSES.join(",")})`)
    .gte("created_at", since);
  if (provider) query = query.eq("provider", provider);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Limit Engine: lecture de l'usage échouée (${error.message})`);
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

/**
 * Nombre d'opérations de l'utilisateur sur une fenêtre glissante de
 * `periodHours` heures. `provider` : voir `getAmountUsage`.
 */
export async function getFrequencyUsage(userId: string, periodHours: number, provider?: Provider | null): Promise<number> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

  let query = admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", userId)
    .not("status", "in", `(${EXCLUDED_STATUSES.join(",")})`)
    .gte("created_at", since);
  if (provider) query = query.eq("provider", provider);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Limit Engine: lecture de la fréquence échouée (${error.message})`);
  }

  return count ?? 0;
}
