"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/domains/identity/security-events";
import { getProviderConfig } from "./providers";
import type { Provider } from "@/lib/supabase/database.types";

export type ActionResult = { error: string } | { success: true };

const VALID_PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];

export async function linkAccountAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const provider = String(formData.get("provider") ?? "") as Provider;
  const externalReference = String(formData.get("externalReference") ?? "").trim();
  const consent = formData.get("consent") === "on";

  if (!VALID_PROVIDERS.includes(provider)) {
    return { error: "form.error.required" };
  }
  if (externalReference.length < 4) {
    return { error: "accounts.error.referenceInvalid" };
  }
  if (!consent) {
    return { error: "accounts.error.consentRequired" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const { capabilities } = getProviderConfig(provider);

  // Un compte précédemment délié (status = unlinked) avec la même
  // référence est reconnecté plutôt que dupliqué — "reconnexion" fait
  // explicitement partie du périmètre du Prompt 06.
  const { data: existing } = await supabase
    .from("linked_accounts")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .eq("external_reference", externalReference)
    .maybeSingle();

  if (existing && existing.status !== "unlinked") {
    return { error: "accounts.error.alreadyLinked" };
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("linked_accounts")
      .update({
        status: "active",
        consent_status: "granted",
        capabilities,
        unlinked_at: null,
        linked_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      return { error: "accounts.error.linkFailed" };
    }

    await logSecurityEvent({
      userId: user.id,
      type: "account_reconnected",
      metadata: { provider, linkedAccountId: existing.id },
    });

    revalidatePath("/accounts");
    return { success: true };
  }

  const { data: linkedAccount, error } = await supabase
    .from("linked_accounts")
    .insert({
      user_id: user.id,
      provider,
      external_reference: externalReference,
      capabilities,
      status: "active",
      consent_status: "granted",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "accounts.error.alreadyLinked" };
    }
    return { error: "accounts.error.linkFailed" };
  }

  await logSecurityEvent({
    userId: user.id,
    type: "account_linked",
    metadata: { provider, linkedAccountId: linkedAccount.id },
  });

  revalidatePath("/accounts");
  return { success: true };
}

export async function unlinkAccountAction(accountId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "session.error.expired" };
  }

  const { error } = await supabase
    .from("linked_accounts")
    .update({
      status: "unlinked",
      consent_status: "revoked",
      unlinked_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "accounts.error.unlinkFailed" };
  }

  await logSecurityEvent({
    userId: user.id,
    type: "account_unlinked",
    metadata: { linkedAccountId: accountId },
  });

  revalidatePath("/accounts");
  return { success: true };
}
