import { adminListRiskAndFraudEvents, RISK_REASON_PREFIXES } from "@/domains/payments/history";
import { requirePermission } from "@/domains/rbac";
import { RiskFraudEventsView } from "../../risk-fraud-events-view";

export default async function AdminRiskPage() {
  await requirePermission("risk.read");

  const events = await adminListRiskAndFraudEvents(RISK_REASON_PREFIXES);
  return <RiskFraudEventsView title="nav.admin.risk" events={events} />;
}
