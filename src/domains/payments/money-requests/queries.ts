import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MoneyRequestRow } from "./types";

/**
 * Liste les propres demandes d'un utilisateur — passe par le client RLS
 * (pas service_role) : `money_requests_select_own` autorise déjà
 * exactement cet accès, inutile d'élever les privilèges.
 */
export async function listOwnMoneyRequests(userId: string): Promise<MoneyRequestRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("money_requests")
    .select("*")
    .eq("requester_user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Résout une demande par son jeton — utilisé par la page publique du
 * lien de partage (`/pay/[token]`). Passe par service_role : la table
 * n'a aucune policy RLS de lecture par jeton (voir 0010_money_requests.sql)
 * pour ne jamais exposer money_requests à l'énumération côté client.
 */
export async function getMoneyRequestByToken(token: string): Promise<MoneyRequestRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("money_requests").select("*").eq("token", token).maybeSingle();
  return data;
}

export async function getMoneyRequestById(id: string): Promise<MoneyRequestRow | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("money_requests").select("*").eq("id", id).maybeSingle();
  return data;
}
