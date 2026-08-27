import { adminListFaqEntries } from "@/domains/faq/queries";
import { requirePermission } from "@/domains/rbac";
import { FaqView } from "./faq-view";

export default async function AdminFaqPage() {
  await requirePermission("faq.manage");

  const entries = await adminListFaqEntries();
  return <FaqView entries={entries} />;
}
