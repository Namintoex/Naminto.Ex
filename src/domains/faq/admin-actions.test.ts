import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateFaqEntry as adminCreateFaqEntryAction, adminSetFaqEntryActive as adminSetFaqEntryActiveAction } from "./admin-mutations";
import { adminListFaqEntries } from "./queries";

/**
 * `listFaqEntries` (lecture publique RLS) dépend de `next/headers`, qui
 * ne s'exécute pas hors du runtime Next.js — même limite déjà documentée
 * pour history/queries.ts et assist/queries.ts (Prompt 21). Ce test
 * vérifie donc l'effet réel de active=false via `adminListFaqEntries`
 * (service_role, voit tout) plutôt que la policy RLS elle-même, qui est
 * vérifiée manuellement dans le navigateur.
 */
describe("Back Office — FAQ admin actions (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("faq_entries").delete().in("id", createdIds);
    }
  });

  it("crée une entrée active puis la désactive", async () => {
    const question = `Vitest question ${Date.now()}?`;
    const created = await adminCreateFaqEntryAction({ locale: "fr", category: "vitest", question, answer: "Réponse test." });
    expect(created).toEqual({ ok: true });

    const { data: entry } = await admin.from("faq_entries").select("*").eq("question", question).single();
    expect(entry).toBeTruthy();
    expect(entry!.active).toBe(true);
    createdIds.push(entry!.id);

    const toggled = await adminSetFaqEntryActiveAction(entry!.id, false);
    expect(toggled).toEqual({ ok: true });

    const entries = await adminListFaqEntries();
    expect(entries.find((e) => e.id === entry!.id)?.active).toBe(false);
  });

  it("refuse une question ou réponse vide", async () => {
    const result = await adminCreateFaqEntryAction({ locale: "fr", category: "general", question: "  ", answer: "" });
    expect(result).toEqual({ ok: false, error: "admin.faq.error.required" });
  });
});
