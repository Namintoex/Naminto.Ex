import { adminListLegalDocuments } from "@/domains/legal/queries";
import { requirePermission } from "@/domains/rbac";
import { LegalView } from "./legal-view";

export default async function AdminLegalPage() {
  await requirePermission("legal.manage");

  const documents = await adminListLegalDocuments();
  return <LegalView documents={documents} />;
}
