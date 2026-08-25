import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateLedgerAccount } from "./accounts";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie la
 * résolution idempotente d'un compte du grand livre via
 * `ledger_accounts_unique_idx` (supabase/migrations/0008_ledger.sql).
 */
describe("Ledger — getOrCreateLedgerAccount (intégration)", () => {
  const admin = createAdminClient();
  const currency = `TST${randomUUID().slice(0, 5).toUpperCase()}`;
  const createdAccountIds: string[] = [];

  afterAll(async () => {
    if (createdAccountIds.length > 0) {
      await admin.from("ledger_accounts").delete().in("id", createdAccountIds);
    }
  });

  it("crée le compte au premier appel puis le réutilise (idempotent)", async () => {
    const ref = { ownerType: "fee_revenue" as const, currency };

    const firstId = await getOrCreateLedgerAccount(ref);
    createdAccountIds.push(firstId);
    const secondId = await getOrCreateLedgerAccount(ref);

    expect(secondId).toBe(firstId);

    const { count } = await admin
      .from("ledger_accounts")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "fee_revenue")
      .eq("currency", currency);
    expect(count).toBe(1);
  });

  it("des références distinctes (devise différente) produisent des comptes distincts", async () => {
    const otherCurrency = `${currency}B`;
    const idA = await getOrCreateLedgerAccount({ ownerType: "fee_revenue" as const, currency });
    const idB = await getOrCreateLedgerAccount({ ownerType: "fee_revenue" as const, currency: otherCurrency });
    createdAccountIds.push(idB);

    expect(idB).not.toBe(idA);
  });

  it("provider distingue deux comptes de transit fournisseur même devise", async () => {
    const idOrange = await getOrCreateLedgerAccount({
      ownerType: "provider_suspense" as const,
      provider: "orange",
      currency,
    });
    const idMtn = await getOrCreateLedgerAccount({
      ownerType: "provider_suspense" as const,
      provider: "mtn",
      currency,
    });
    createdAccountIds.push(idOrange, idMtn);

    expect(idOrange).not.toBe(idMtn);
  });
});
