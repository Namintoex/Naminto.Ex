import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Écritures Back Office — FAQ (Prompt 22). Séparées de admin-actions.ts
 * ("use server") pour rester testables directement (revalidatePath ne
 * s'exécute pas hors du runtime Next.js).
 */
export async function adminCreateFaqEntry(input: {
  locale: Locale;
  category: string;
  question: string;
  answer: string;
}): Promise<AdminActionResult> {
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (!question || !answer) return { ok: false, error: "admin.faq.error.required" };

  const admin = createAdminClient();
  const { error } = await admin.from("faq_entries").insert({
    locale: input.locale,
    category: input.category.trim() || "general",
    question,
    answer,
  });
  if (error) return { ok: false, error: "admin.faq.error.createFailed" };

  return { ok: true };
}

export async function adminSetFaqEntryActive(id: string, active: boolean): Promise<AdminActionResult> {
  const admin = createAdminClient();
  const { error } = await admin.from("faq_entries").update({ active }).eq("id", id);
  if (error) return { ok: false, error: "admin.faq.error.updateFailed" };

  return { ok: true };
}
