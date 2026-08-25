import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFrequencyUsage } from "../limit-engine/usage-queries";
import type { DeviceStatus } from "@/lib/supabase/database.types";
import type { RiskCheckInput } from "./types";

const SETTLED_STATUS = "settled";

export type ResolvedDeviceStatus = DeviceStatus | "unknown" | "unspecified";

export interface RiskContextData {
  /** Nombre d'opérations de l'expéditeur sur la dernière heure — réutilise
   *  directement le Limit Engine (Prompt 11), jamais dupliqué. */
  frequencyLastHour: number;
  /** Nombre de transactions déjà réglées (statut settled) à vie pour cet
   *  expéditeur — proxy de maturité du compte. */
  historyCount: number;
  historyAverageAmount: number | null;
  deviceStatus: ResolvedDeviceStatus;
  isNewBeneficiary: boolean;
}

async function resolveDeviceStatus(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  fingerprint: string | null
): Promise<ResolvedDeviceStatus> {
  if (!fingerprint) return "unspecified";
  const { data } = await admin
    .from("devices")
    .select("status")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();
  return data?.status ?? "unknown";
}

/**
 * Un « nouveau bénéficiaire » se juge uniquement quand la contrepartie
 * est identifiable (un utilisateur Naminto.Ex ou une référence externe).
 * Un compte lié du titulaire lui-même (`linked_account`) n'est jamais
 * traité comme un bénéficiaire — ni nouveau, ni risqué à ce titre.
 */
async function resolveIsNewBeneficiary(
  admin: ReturnType<typeof createAdminClient>,
  input: RiskCheckInput
): Promise<boolean> {
  if (input.destinationType === "linked_account") {
    return false;
  }

  let query = admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("sender_user_id", input.senderUserId)
    .eq("status", SETTLED_STATUS);

  if (input.destinationType === "naminto_wallet" && input.recipientUserId) {
    query = query.eq("recipient_user_id", input.recipientUserId);
  } else if (input.destinationType === "external" && input.destinationExternalReference) {
    query = query.eq("destination_external_reference", input.destinationExternalReference);
  } else {
    return false;
  }

  const { count } = await query;
  return !(count && count > 0);
}

/**
 * Rassemble toutes les données brutes dont les signaux de risque
 * (assess-risk.ts) ont besoin — une seule couche d'accès aux données,
 * séparée du calcul pur pour rester testable sans base (voir le Limit
 * Engine, même principe).
 */
export async function fetchRiskContext(input: RiskCheckInput): Promise<RiskContextData> {
  const admin = createAdminClient();

  const [frequencyLastHour, history, deviceStatus, isNewBeneficiary] = await Promise.all([
    getFrequencyUsage(input.senderUserId, 1),
    admin.from("transactions").select("amount").eq("sender_user_id", input.senderUserId).eq("status", SETTLED_STATUS),
    resolveDeviceStatus(admin, input.senderUserId, input.deviceFingerprint),
    resolveIsNewBeneficiary(admin, input),
  ]);

  const settledAmounts = (history.data ?? []).map((row) => Number(row.amount));
  const historyCount = settledAmounts.length;
  const historyAverageAmount =
    historyCount > 0 ? settledAmounts.reduce((sum, a) => sum + a, 0) / historyCount : null;

  return { frequencyLastHour, historyCount, historyAverageAmount, deviceStatus, isNewBeneficiary };
}
