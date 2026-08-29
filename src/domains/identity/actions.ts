"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateDeviceCookie, registerDevice } from "./devices";
import { hashLoginEmail, isLoginLocked, recordLoginFailure, resetLoginAttempts } from "./login-lockout";
import { hashPin, isValidPinFormat, verifyPinForUser } from "./pin";
import { logSecurityEvent } from "./security-events";

export type ActionResult = { error: string } | { success: true };

async function hashIp(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

function isValidNamintoId(value: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const legalName = String(formData.get("legalName") ?? "").trim();
  const namintoId = String(formData.get("namintoId") ?? "").trim().toLowerCase();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();

  if (!email || !password || !legalName || !namintoId || !phoneNumber) {
    return { error: "form.error.required" };
  }
  if (password.length < 8) {
    return { error: "register.error.passwordTooShort" };
  }
  if (!isValidNamintoId(namintoId)) {
    return { error: "register.error.namintoIdInvalid" };
  }

  const h = await headers();
  const origin = h.get("origin") ?? "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        naminto_id: namintoId,
        legal_name: legalName,
        phone_number: phoneNumber,
      },
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/security/pin?welcome=1")}`,
    },
  });

  if (error) {
    return { error: error.message };
  }
  if (!data.user) {
    return { error: "register.error.unknown" };
  }

  if (!data.session) {
    // Confirmation par e-mail requise avant de pouvoir se connecter.
    redirect(`/register/check-email?email=${encodeURIComponent(email)}`);
  }

  redirect("/security/pin?welcome=1");
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "form.error.required" };
  }

  // Anti-brute-force (Prompt 28, ADR-056) — vérifié avant même d'appeler
  // Supabase Auth, contre une adresse existante ou non.
  const emailHash = hashLoginEmail(email);
  if (await isLoginLocked(emailHash)) {
    return { error: "login.error.tooManyAttempts" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const ipHash = await hashIp();

  if (error || !data.user) {
    await recordLoginFailure(emailHash);
    return { error: "login.error.invalidCredentials" };
  }

  await resetLoginAttempts(emailHash);

  const deviceFingerprint = await getOrCreateDeviceCookie();
  const h = await headers();
  const { deviceId, isNewDevice } = await registerDevice({
    userId: data.user.id,
    deviceFingerprint,
    platform: h.get("user-agent")?.slice(0, 200) ?? null,
  });

  await logSecurityEvent({
    userId: data.user.id,
    type: "login_success",
    deviceId,
    ipHash,
    metadata: { newDevice: isNewDevice },
  });

  if (isNewDevice) {
    await logSecurityEvent({
      userId: data.user.id,
      type: "new_device_login",
      deviceId,
      ipHash,
    });
  }

  const admin = createAdminClient();
  const { data: pinCredentials } = await admin
    .from("pin_credentials")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!pinCredentials) {
    redirect("/security/pin?welcome=1");
  }

  const next = String(formData.get("next") ?? "").trim();
  redirect(next.startsWith("/") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await logSecurityEvent({ userId: user.id, type: "logout" });
  }

  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "form.error.required" };
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? "";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password/confirm`,
  });

  // Réponse volontairement identique que l'email existe ou non
  // (ne pas révéler si une adresse est enregistrée).
  return { success: true };
}

export async function updatePasswordAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8) {
    return { error: "register.error.passwordTooShort" };
  }
  if (password !== passwordConfirm) {
    return { error: "pin.error.mismatch" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  await logSecurityEvent({ userId: user.id, type: "password_changed" });
  await supabase.auth.signOut();
  redirect("/login?resetSuccess=1");
}

export async function createPinAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const pin = String(formData.get("pin") ?? "");
  const pinConfirm = String(formData.get("pinConfirm") ?? "");

  if (!isValidPinFormat(pin)) {
    return { error: "pin.error.format" };
  }
  if (pin !== pinConfirm) {
    return { error: "pin.error.mismatch" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("pin_credentials")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Un PIN déjà défini ne peut être remplacé qu'en prouvant la
  // connaissance du PIN actuel (revue de code — sans cette vérification,
  // une session volée/hébergée par un XSS pouvait installer un nouveau
  // PIN de son choix puis l'utiliser immédiatement pour autoriser un
  // paiement, sans jamais connaître le vrai PIN de la victime). Réutilise
  // `verifyPinForUser` — même verrouillage anti-brute-force que
  // `verifyPinAction`, jamais une seconde surface de tentative parallèle.
  if (existing) {
    const currentPin = String(formData.get("currentPin") ?? "");
    const verification = await verifyPinForUser(user.id, currentPin);
    if (!verification.ok) {
      if (verification.reason === "locked") return { error: "pin.error.locked" };
      return { error: "pin.error.invalid" };
    }
  }

  const pinHash = await hashPin(pin);

  if (existing) {
    await admin
      .from("pin_credentials")
      .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null })
      .eq("user_id", user.id);
  } else {
    await admin.from("pin_credentials").insert({ user_id: user.id, pin_hash: pinHash });
  }

  await logSecurityEvent({
    userId: user.id,
    type: existing ? "pin_changed" : "pin_created",
  });

  redirect("/");
}

export async function verifyPinAction(pin: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const result = await verifyPinForUser(user.id, pin);
  if (result.ok) {
    return { success: true };
  }

  const errorKey = {
    not_set: "pin.error.notSet",
    locked: "pin.error.locked",
    invalid: "pin.error.invalid",
  } as const;
  return { error: errorKey[result.reason] };
}

export async function revokeDeviceAction(deviceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const { error } = await supabase
    .from("devices")
    .update({ status: "revoked" })
    .eq("id", deviceId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "devices.error.revokeFailed" };
  }

  await logSecurityEvent({ userId: user.id, type: "device_revoked", deviceId });
  return { success: true };
}
