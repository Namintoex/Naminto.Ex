"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { adminCreateCountry, adminSetCountryActive, type AdminActionResult } from "./admin-mutations";

export type { AdminActionResult };

export async function adminCreateCountryAction(input: {
  code: string;
  name: string;
  currency: string;
}): Promise<AdminActionResult> {
  const auth = await checkPermission("country.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminCreateCountry(input);
  if (result.ok) revalidatePath("/admin/countries");
  return result;
}

export async function adminSetCountryActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const auth = await checkPermission("country.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminSetCountryActive(id, active);
  if (result.ok) revalidatePath("/admin/countries");
  return result;
}
