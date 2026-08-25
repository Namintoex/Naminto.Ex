import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("identity_profiles")
    .select(
      "naminto_id, legal_name, phone_number, phone_verified, kyc_status, preferred_language, preferred_currency, notifications_enabled, sound_enabled"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
