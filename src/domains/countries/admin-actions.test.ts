import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateCountry as adminCreateCountryAction, adminSetCountryActive as adminSetCountryActiveAction } from "./admin-mutations";

describe("Back Office — Countries admin actions (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("countries").delete().in("id", createdIds);
    }
  });

  it("crée un pays, normalise le code en majuscules, refuse un champ manquant", async () => {
    const code = `t${randomUUID().slice(0, 4)}`;
    const created = await adminCreateCountryAction({ code, name: "Testland", currency: "xof" });
    expect(created).toEqual({ ok: true });

    const { data: country } = await admin.from("countries").select("*").eq("code", code.toUpperCase()).single();
    expect(country).toBeTruthy();
    expect(country!.currency).toBe("XOF");
    createdIds.push(country!.id);

    const missing = await adminCreateCountryAction({ code: "", name: "", currency: "XOF" });
    expect(missing).toEqual({ ok: false, error: "admin.countries.error.required" });

    const toggled = await adminSetCountryActiveAction(country!.id, false);
    expect(toggled).toEqual({ ok: true });

    const { data: after } = await admin.from("countries").select("active").eq("id", country!.id).single();
    expect(after?.active).toBe(false);
  });
});
