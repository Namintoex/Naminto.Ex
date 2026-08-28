import { adminObservabilityOverview } from "@/domains/observability";
import { requirePermission } from "@/domains/rbac";
import { ObservabilityView } from "./observability-view";

export default async function AdminObservabilityPage() {
  await requirePermission("observability.read");

  const overview = await adminObservabilityOverview(24);

  return <ObservabilityView overview={overview} />;
}
