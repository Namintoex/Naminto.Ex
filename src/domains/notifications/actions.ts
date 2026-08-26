"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead } from "./queries";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await markNotificationRead(notificationId, user.id);
  revalidatePath("/notifications");
}
