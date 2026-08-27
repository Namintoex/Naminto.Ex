import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export type LegalDocumentRow = Database["public"]["Tables"]["legal_documents"]["Row"];

/** Back Office — voit aussi les brouillons non publiés, donc service_role. */
export async function adminListLegalDocuments(): Promise<LegalDocumentRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("legal_documents").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
