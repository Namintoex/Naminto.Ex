import { requirePermission } from "@/domains/rbac";
import { ComingSoonPage } from "@/shell/coming-soon-page";

export default async function Page() {
  await requirePermission("incident.read");
  return <ComingSoonPage titleKey="nav.admin.incidents" />;
}
