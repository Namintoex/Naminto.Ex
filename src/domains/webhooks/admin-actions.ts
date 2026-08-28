"use server";

import { revalidatePath } from "next/cache";
import { checkPermission } from "@/domains/rbac";
import { adminReplayWebhookEvent, type AdminReplayResult } from "./replay";

export type { AdminReplayResult };

export async function adminReplayWebhookEventAction(eventRowId: string): Promise<AdminReplayResult> {
  const auth = await checkPermission("webhook.manage");
  if (!auth.ok) return { ok: false, error: "admin.error.forbidden" };

  const result = await adminReplayWebhookEvent(eventRowId, auth.userId);
  if (result.ok) revalidatePath("/admin/webhooks");
  return result;
}
