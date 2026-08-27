import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateLimitRule, adminListLimitRules, adminSetLimitRuleActive } from "./admin-queries";

describe("Back Office — Pricing/Limits admin queries (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("limit_rules").delete().in("id", createdIds);
    }
  });

  it("crée une règle de fréquence puis la désactive", async () => {
    const created = await adminCreateLimitRule({ limit_type: "frequency_count", max_count: 999_999, period_hours: 1 });
    expect("id" in created).toBe(true);
    const ruleId = (created as { id: string }).id;
    createdIds.push(ruleId);

    const rules = await adminListLimitRules();
    const rule = rules.find((r) => r.id === ruleId);
    expect(rule).toBeDefined();
    expect(rule!.active).toBe(true);

    const toggled = await adminSetLimitRuleActive(ruleId, false);
    expect(toggled).toBe(true);

    const rulesAfter = await adminListLimitRules();
    expect(rulesAfter.find((r) => r.id === ruleId)?.active).toBe(false);
  });
});
