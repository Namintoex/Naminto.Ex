"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/design-system";
import { useLocale } from "@/design-system/i18n/locale-provider";
import type { Database } from "@/lib/supabase/database.types";
import { FeeRulesPanel } from "./fee-rules-panel";
import { LimitRulesPanel } from "./limit-rules-panel";
import { ComplianceRulesPanel } from "./compliance-rules-panel";

export function PricingView({
  feeRules,
  limitRules,
  complianceRules,
}: {
  feeRules: Database["public"]["Tables"]["fee_rules"]["Row"][];
  limitRules: Database["public"]["Tables"]["limit_rules"]["Row"][];
  complianceRules: Database["public"]["Tables"]["compliance_rules"]["Row"][];
}) {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-text-primary">{t("nav.admin.pricing")}</h1>

      <Tabs defaultValue="fees">
        <TabsList>
          <TabsTrigger value="fees">{t("admin.pricing.tab.fees")}</TabsTrigger>
          <TabsTrigger value="limits">{t("admin.pricing.tab.limits")}</TabsTrigger>
          <TabsTrigger value="compliance">{t("admin.pricing.tab.compliance")}</TabsTrigger>
        </TabsList>
        <TabsContent value="fees">
          <FeeRulesPanel rules={feeRules} />
        </TabsContent>
        <TabsContent value="limits">
          <LimitRulesPanel rules={limitRules} />
        </TabsContent>
        <TabsContent value="compliance">
          <ComplianceRulesPanel rules={complianceRules} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
