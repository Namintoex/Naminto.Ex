"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/domains/identity/security-events";
import type { Locale } from "@/lib/supabase/database.types";

export type ActionResult = { error: string } | { success: true };

const SUPPORTED_LOCALES: Locale[] = ["fr", "en"];
// Lancement FCFA uniquement — multi-devises prévu au Prompt 29.
const SUPPORTED_CURRENCIES = ["XOF"];

export async function updatePreferencesAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "");
  const preferredCurrency = String(formData.get("preferredCurrency") ?? "");
  const notificationsEnabled = formData.get("notificationsEnabled") === "on";
  const soundEnabled = formData.get("soundEnabled") === "on";
  const notifyInApp = formData.get("notifyInApp") === "on";
  const notifyPush = formData.get("notifyPush") === "on";
  const notifySms = formData.get("notifySms") === "on";

  if (!SUPPORTED_LOCALES.includes(preferredLanguage as Locale)) {
    return { error: "form.error.required" };
  }
  if (!SUPPORTED_CURRENCIES.includes(preferredCurrency)) {
    return { error: "form.error.required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const { error } = await supabase
    .from("identity_profiles")
    .update({
      preferred_language: preferredLanguage as Locale,
      preferred_currency: preferredCurrency,
      notifications_enabled: notificationsEnabled,
      sound_enabled: soundEnabled,
      notify_in_app: notifyInApp,
      notify_push: notifyPush,
      notify_sms: notifySms,
    })
    .eq("user_id", user.id);

  if (error) {
    return { error: "settings.error.updateFailed" };
  }

  await logSecurityEvent({
    userId: user.id,
    type: "preferences_updated",
    metadata: {
      preferredLanguage,
      preferredCurrency,
      notificationsEnabled,
      soundEnabled,
      notifyInApp,
      notifyPush,
      notifySms,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}
