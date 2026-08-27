"use server";

import { revalidatePath } from "next/cache";
import { adminCreateFaqEntry, adminSetFaqEntryActive, type AdminActionResult } from "./admin-mutations";
import type { Locale } from "@/lib/supabase/database.types";

export type { AdminActionResult };

export async function adminCreateFaqEntryAction(input: {
  locale: Locale;
  category: string;
  question: string;
  answer: string;
}): Promise<AdminActionResult> {
  const result = await adminCreateFaqEntry(input);
  if (result.ok) revalidatePath("/admin/faq");
  return result;
}

export async function adminSetFaqEntryActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const result = await adminSetFaqEntryActive(id, active);
  if (result.ok) revalidatePath("/admin/faq");
  return result;
}
