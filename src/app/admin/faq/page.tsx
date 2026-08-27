import { adminListFaqEntries } from "@/domains/faq/queries";
import { FaqView } from "./faq-view";

export default async function AdminFaqPage() {
  const entries = await adminListFaqEntries();
  return <FaqView entries={entries} />;
}
