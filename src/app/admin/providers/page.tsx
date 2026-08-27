import { adminListProviders } from "@/domains/providers/admin-queries";
import { ProvidersView } from "./providers-view";

export default async function AdminProvidersPage() {
  const providers = await adminListProviders();
  return <ProvidersView providers={providers} />;
}
