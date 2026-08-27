import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminListLedgerAccounts, adminListLedgerEntries } from "./admin-queries";

/**
 * Test d'intégration contre le vrai projet Supabase — vérifie uniquement
 * l'agrégation ajoutée par le Back Office (solde = crédits − débits,
 * jamais stocké) sur des écritures insérées directement en fixture :
 * l'écriture réelle des écritures équilibrées reste couverte par
 * record-entries.test.ts (Prompt 12), pas dupliquée ici.
 *
 * Pas de nettoyage en afterAll, volontairement : `ledger_entries` est
 * append-only même pour service_role (0008_ledger.sql, ADR-038) — un
 * DELETE échoue réellement (contrainte base), pas seulement par
 * politesse. Une fois des écritures posées, le compte et la transaction
 * associés ne peuvent plus être supprimés non plus (FK). Même choix déjà
 * établi par record-entries.test.ts : les fixtures « réglées » restent
 * en base en permanence, comme en production — une devise de test
 * unique par run (`testCurrency`) garantit qu'elles n'interfèrent
 * jamais avec un autre test.
 */
describe("Back Office — adminListLedgerAccounts / adminListLedgerEntries (intégration)", () => {
  const admin = createAdminClient();

  it("calcule le solde d'un compte comme crédits − débits, jamais une colonne stockée", async () => {
    // Devise de test unique : un compte fee_revenue/XOF réel existe déjà
    // (accumulé par les vraies transactions réglées de la suite
    // complète) — y insérer fausserait le solde attendu ci-dessous.
    const testCurrency = `TEST_${randomUUID().slice(0, 6)}`;

    const { data: account, error } = await admin
      .from("ledger_accounts")
      .insert({ owner_type: "fee_revenue", currency: testCurrency })
      .select("id")
      .single();
    if (error || !account) throw new Error(`Setup échoué: ${error?.message}`);

    const { data: senderAccount } = await admin
      .from("ledger_accounts")
      .insert({ owner_type: "external_suspense", currency: testCurrency })
      .select("id")
      .single();

    // Une transaction fictive minimale, uniquement pour satisfaire la FK ledger_entries.transaction_id.
    const { data: tx } = await admin
      .from("transactions")
      .insert({
        reference: `NEX-VITEST${randomUUID().slice(0, 6).toUpperCase()}`,
        source_type: "linked_account",
        destination_type: "external",
        amount: 1000,
        currency: testCurrency,
        fee: 35,
        total: 1035,
        fee_payer: "sender",
        idempotency_key: randomUUID(),
        status: "settled",
      })
      .select("id, reference")
      .single();

    await admin.from("ledger_entries").insert([
      {
        transaction_id: tx!.id,
        account_id: account.id,
        kind: "settlement",
        direction: "credit",
        amount: 35,
        currency: testCurrency,
        reference: tx!.reference,
      },
      {
        transaction_id: tx!.id,
        account_id: senderAccount!.id,
        kind: "settlement",
        direction: "debit",
        amount: 35,
        currency: testCurrency,
        reference: tx!.reference,
      },
    ]);

    const accounts = await adminListLedgerAccounts();
    const feeAccount = accounts.find((a) => a.id === account.id);
    expect(feeAccount?.balance).toBe(35);

    const susAccount = accounts.find((a) => a.id === senderAccount!.id);
    expect(susAccount?.balance).toBe(-35);

    const entries = await adminListLedgerEntries(account.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].direction).toBe("credit");
  });
});
