import { adminListRoleAssignments } from "@/domains/rbac";
import { requirePermission } from "@/domains/rbac";
import { RolesView } from "./roles-view";

export default async function AdminRolesPage() {
  await requirePermission("role.manage");

  const assignments = await adminListRoleAssignments();
  return <RolesView assignments={assignments} />;
}
