import { adminListRiskAndFraudEvents, RISK_REASON_PREFIXES } from "@/domains/payments/history";
import { RiskFraudEventsView } from "../risk-fraud-events-view";

export default async function AdminRiskPage() {
  const events = await adminListRiskAndFraudEvents(RISK_REASON_PREFIXES);
  return <RiskFraudEventsView title="nav.admin.risk" events={events} />;
}
