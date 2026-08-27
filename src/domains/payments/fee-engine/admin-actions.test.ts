import { randomUUID } from "crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminCreateFeeRule, adminListFeeRules, adminSetFeeRuleActive } from "./admin-queries";

describe("Back Office — Pricing/Fees admin queries (intégration)", () => {
  const admin = createAdminClient();
  const createdIds: string[] = [];

  afterAll(async () => {
    if (createdIds.length > 0) {
      await admin.from("fee_rules").delete().in("id", createdIds);
    }
  });

  it("crée une règle réellement lisible ensuite, puis la désactive", async () => {
    const currency = `TEST_${randomUUID().slice(0, 6)}`;
    const created = await adminCreateFeeRule({ currency, rate_percent: 0.02, flat_fee: 10, fee_payer: "sender" });
    expect("id" in created).toBe(true);
    const ruleId = (created as { id: string }).id;
    createdIds.push(ruleId);

    const rules = await adminListFeeRules();
    const rule = rules.find((r) => r.id === ruleId);
    expect(rule).toBeDefined();
    expect(rule!.active).toBe(true);

    const toggled = await adminSetFeeRuleActive(ruleId, false);
    expect(toggled).toBe(true);

    const rulesAfter = await adminListFeeRules();
    expect(rulesAfter.find((r) => r.id === ruleId)?.active).toBe(false);
  });
});
