import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { MONEY_REQUEST_TTL_MS, type MoneyRequestRow } from "./types";

export interface CreateMoneyRequestParams {
  requesterUserId: string;
  amount: number;
  currency?: string;
  note?: string | null;
}

/**
 * Crée une demande d'argent avec un jeton de capacité non devinable
 * (voir 0010_money_requests.sql) et une échéance par défaut. `token`
 * utilise le même générateur que `idempotencyKey` ailleurs dans ce
 * domaine (crypto.randomUUID, 122 bits d'entropie) — suffisant pour un
 * identifiant de capacité, jamais un secret cryptographique au sens
 * strict (personne n'a besoin de le "casser", seulement de ne jamais le
 * deviner).
 */
export async function createMoneyRequest(params: CreateMoneyRequestParams): Promise<MoneyRequestRow> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("money_requests")
    .insert({
      requester_user_id: params.requesterUserId,
      token: randomUUID(),
      amount: params.amount,
      currency: params.currency ?? "XOF",
      note: params.note ?? null,
      expires_at: new Date(Date.now() + MONEY_REQUEST_TTL_MS).toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createMoneyRequest failed: ${error?.message ?? "unknown error"}`);
  }
  return data;
}
