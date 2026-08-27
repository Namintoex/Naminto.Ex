import { adminListFeeRules } from "@/domains/payments/fee-engine";
import { adminListLimitRules } from "@/domains/payments/limit-engine";
import { adminListComplianceRules } from "@/domains/payments/compliance-engine";
import { requirePermission } from "@/domains/rbac";
import { PricingView } from "./pricing-view";

export default async function AdminPricingPage() {
  await requirePermission("pricing.read");

  const [feeRules, limitRules, complianceRules] = await Promise.all([
    adminListFeeRules(),
    adminListLimitRules(),
    adminListComplianceRules(),
  ]);

  return <PricingView feeRules={feeRules} limitRules={limitRules} complianceRules={complianceRules} />;
}
