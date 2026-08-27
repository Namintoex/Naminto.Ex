"use server";

import { revalidatePath } from "next/cache";
import { adminCreateLegalDocument, adminSetLegalDocumentPublished, type AdminActionResult } from "./admin-mutations";
import type { LegalDocumentType, Locale } from "@/lib/supabase/database.types";

export type { AdminActionResult };

export async function adminCreateLegalDocumentAction(input: {
  type: LegalDocumentType;
  locale: Locale;
  title: string;
  content: string;
  version: string;
}): Promise<AdminActionResult> {
  const result = await adminCreateLegalDocument(input);
  if (result.ok) revalidatePath("/admin/legal");
  return result;
}

export async function adminSetLegalDocumentPublishedAction(id: string, published: boolean): Promise<AdminActionResult> {
  const result = await adminSetLegalDocumentPublished(id, published);
  if (result.ok) revalidatePath("/admin/legal");
  return result;
}
