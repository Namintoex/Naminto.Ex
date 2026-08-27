import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LegalDocumentType, Locale } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Écritures Back Office — Legal (Prompt 22). Séparées de
 * admin-actions.ts ("use server") pour rester testables directement
 * (revalidatePath ne s'exécute pas hors du runtime Next.js).
 */
export async function adminCreateLegalDocument(input: {
  type: LegalDocumentType;
  locale: Locale;
  title: string;
  content: string;
  version: string;
}): Promise<AdminActionResult> {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) return { ok: false, error: "admin.legal.error.required" };

  const admin = createAdminClient();
  const { error } = await admin.from("legal_documents").insert({
    type: input.type,
    locale: input.locale,
    title,
    content,
    version: input.version.trim() || "1.0",
  });
  if (error) return { ok: false, error: "admin.legal.error.createFailed" };

  return { ok: true };
}

export async function adminSetLegalDocumentPublished(id: string, published: boolean): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("legal_documents").update({ published }).eq("id", id);
  if (error) return { ok: false, error: "admin.legal.error.updateFailed" };

  return { ok: true };
}
