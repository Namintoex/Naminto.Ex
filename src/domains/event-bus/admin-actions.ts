"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { dispatchDueDeliveries, retryDeliveryNow, type DispatchSummary, type RetryDeliveryResult } from "./dispatch";

export type AdminDispatchResult = { ok: true; summary: DispatchSummary } | { ok: false; error: string };

export async function adminDispatchDueDeliveriesAction(): Promise<AdminDispatchResult> {
  const auth = await checkPermission("event.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const summary = await dispatchDueDeliveries();
  revalidatePath("/admin/events");
  return { ok: true, summary };
}

export async function adminRetryDeliveryAction(deliveryId: string): Promise<RetryDeliveryResult> {
  const auth = await checkPermission("event.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await retryDeliveryNow(deliveryId);
  if (result.ok) revalidatePath("/admin/events");
  return result;
}
