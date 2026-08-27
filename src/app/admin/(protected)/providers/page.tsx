import { adminListProviders } from "@/domains/providers/admin-queries";
import { requirePermission } from "@/domains/rbac";
import { ProvidersView } from "./providers-view";

export default async function AdminProvidersPage() {
  await requirePermission("provider.read");

  const providers = await adminListProviders();
  return <ProvidersView providers={providers} />;
}
