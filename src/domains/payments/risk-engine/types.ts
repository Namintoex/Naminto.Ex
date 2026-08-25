import type { DestinationType } from "@/lib/supabase/database.types";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskSignalCode =
  | "amount"
  | "frequency"
  | "history"
  | "device"
  | "beneficiary"
  | "behavior"
  | "context";

/**
 * Une raison structurée (Prompt 17 : « chaque décision doit avoir des
 * raisons structurées ») — jamais une simple chaîne opaque. `details`
 * porte les valeurs brutes ayant motivé le niveau, pour un futur écran
 * d'audit sans avoir à reparser `reason`.
 */
export interface RiskSignal {
  code: RiskSignalCode;
  level: RiskLevel;
  reason: string;
  details?: Record<string, unknown>;
}

export interface RiskDecision {
  level: RiskLevel;
  reasons: RiskSignal[];
}

export interface RiskCheckInput {
  senderUserId: string;
  amount: number;
  currency: string;
  destinationType: DestinationType;
  recipientUserId: string | null;
  destinationExternalReference: string | null;
  /** Empreinte d'appareil (cookie `nx_device_id`, Identity/Prompt 04) —
   *  `null` si l'appelant ne l'a pas transmise (jamais pénalisé comme un
   *  signal négatif : voir computeDeviceSignal). */
  deviceFingerprint: string | null;
}
