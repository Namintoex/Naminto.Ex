import { adminListLegalDocuments } from "@/domains/legal/queries";
import { LegalView } from "./legal-view";

export default async function AdminLegalPage() {
  const documents = await adminListLegalDocuments();
  return <LegalView documents={documents} />;
}
