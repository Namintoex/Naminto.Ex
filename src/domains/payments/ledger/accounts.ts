import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LedgerAccountRef } from "./types";
import type { Provider } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

function selectByRef(admin: AdminClient, ref: LedgerAccountRef, ownerId: string | null, provider: Provider | null) {
  let q = admin.from("ledger_accounts").select("id").eq("owner_type", ref.ownerType).eq("currency", ref.currency);
  q = ownerId === null ? q.is("owner_id", null) : q.eq("owner_id", ownerId);
  q = provider === null ? q.is("provider", null) : q.eq("provider", provider);
  return q;
}

/**
 * Résout un compte du grand livre à partir de sa référence logique,
 * en le créant s'il n'existe pas encore. Idempotent grâce à
 * `ledger_accounts_unique_idx` (supabase/migrations/0008_ledger.sql) :
 * en cas de course entre deux appels concurrents, celui qui perd la
 * course sur l'INSERT relit simplement le compte créé par l'autre.
 */
export async function getOrCreateLedgerAccount(ref: LedgerAccountRef): Promise<string> {
  const admin = createAdminClient();
  const ownerId = ref.ownerId ?? null;
  const provider = ref.provider ?? null;

  const { data: existing } = await selectByRef(admin, ref, ownerId, provider).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("ledger_accounts")
    .insert({ owner_type: ref.ownerType, owner_id: ownerId, provider, currency: ref.currency })
    .select("id")
    .single();

  if (created) return created.id;

  if (error?.code === "23505") {
    const { data: retried } = await selectByRef(admin, ref, ownerId, provider).maybeSingle();
    if (retried) return retried.id;
  }

  throw new Error(`getOrCreateLedgerAccount failed: ${error?.message ?? "unknown error"}`);
}
