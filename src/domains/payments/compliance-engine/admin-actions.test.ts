import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateComplianceRule, adminListComplianceRules, adminSetComplianceRuleActive } from "./admin-queries";

describe("Back Office — Pricing/Compliance admin queries (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("compliance_rules").delete().in("id", createdIds);
    }
  });

  it("crée une règle puis la désactive", async () => {
    const currency = `TEST_${randomUUID().slice(0, 6)}`;
    const created = await adminCreateComplianceRule({
      rule_type: "CONFIGURATION",
      requirement: "KYC_STANDARD",
      currency,
      description: "Règle de test admin",
    });
    expect("id" in created).toBe(true);
    const ruleId = (created as { id: string }).id;
    createdIds.push(ruleId);

    const rules = await adminListComplianceRules();
    const rule = rules.find((r) => r.id === ruleId);
    expect(rule).toBeDefined();
    expect(rule!.active).toBe(true);

    const toggled = await adminSetComplianceRuleActive(ruleId, false);
    expect(toggled).toBe(true);

    const rulesAfter = await adminListComplianceRules();
    expect(rulesAfter.find((r) => r.id === ruleId)?.active).toBe(false);
  });
});
