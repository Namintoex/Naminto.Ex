import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const DEVICE_COOKIE = "nx_device_id";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // ~2 ans

/**
 * Lit l'identifiant d'appareil (cookie httpOnly) ou en crée un nouveau.
 * Ce n'est pas une empreinte technique (canvas/user-agent) mais un
 * identifiant opaque et stable par navigateur — suffisant pour distinguer
 * les appareils sans profilage intrusif (privacy by design).
 */
export async function getOrCreateDeviceCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const id = randomUUID();
  cookieStore.set(DEVICE_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DEVICE_COOKIE_MAX_AGE,
    path: "/",
  });
  return id;
}

/**
 * Enregistre / met à jour l'appareil associé à une session, et indique
 * s'il s'agit d'un appareil déjà vu pour cet utilisateur.
 */
export async function registerDevice(params: {
  userId: string;
  deviceFingerprint: string;
  platform?: string | null;
}): Promise<{ deviceId: string; isNewDevice: boolean }> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("devices")
    .select("id, status")
    .eq("user_id", params.userId)
    .eq("device_fingerprint", params.deviceFingerprint)
    .maybeSingle();

  if (existing) {
    await admin
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { deviceId: existing.id, isNewDevice: false };
  }

  const { data: created, error } = await admin
    .from("devices")
    .insert({
      user_id: params.userId,
      device_fingerprint: params.deviceFingerprint,
      platform: params.platform ?? null,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`registerDevice failed: ${error?.message ?? "unknown error"}`);
  }

  return { deviceId: created.id, isNewDevice: true };
}
