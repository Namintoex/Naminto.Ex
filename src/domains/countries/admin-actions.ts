"use server";

import { revalidatePath } from "next/cache";
import { adminCreateCountry, adminSetCountryActive, type AdminActionResult } from "./admin-mutations";

export type { AdminActionResult };

export async function adminCreateCountryAction(input: {
  code: string;
  name: string;
  currency: string;
}): Promise<AdminActionResult> {
  const result = await adminCreateCountry(input);
  if (result.ok) revalidatePath("/admin/countries");
  return result;
}

export async function adminSetCountryActiveAction(id: string, active: boolean): Promise<AdminActionResult> {
  const result = await adminSetCountryActive(id, active);
  if (result.ok) revalidatePath("/admin/countries");
  return result;
}
