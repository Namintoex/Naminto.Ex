import { adminListRiskAndFraudEvents, FRAUD_REASON_PREFIXES } from "@/domains/payments/history";
import { requirePermission } from "@/domains/rbac";
import { RiskFraudEventsView } from "../../risk-fraud-events-view";

export default async function AdminFraudPage() {
  await requirePermission("fraud.read");

  const events = await adminListRiskAndFraudEvents(FRAUD_REASON_PREFIXES);
  return <RiskFraudEventsView title="nav.admin.fraud" events={events} />;
}
