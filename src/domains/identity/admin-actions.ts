"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./queries";
import { adminUpdateKycStatus, type AdminUpdateKycStatusResult } from "./admin-queries";
import type { KycStatus } from "@/lib/supabase/database.types";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/**
 * Wrapper "use server" fin autour de `adminUpdateKycStatus`
 * (admin-queries.ts) : la logique de transition/journalisation vit là,
 * testable directement — ici, seulement le revalidate propre à
 * Next.js. Pas de vérification de rôle (RBAC = Prompt 23, ADR-016).
 */
export async function adminUpdateKycStatusAction(userId: string, next: KycStatus): Promise<AdminUpdateKycStatusResult> {
  const result = await adminUpdateKycStatus(userId, next);
  if (result.ok) {
    revalidatePath("/admin/kyc");
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
  }
  return result;
}

/** Défense en profondeur pour toute action admin sensible : confirme au moins une session active. RBAC réel = Prompt 23. */
export async function requireAuthenticatedAdmin(): Promise<AdminActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "session.error.expired" };
  return { ok: true };
}
