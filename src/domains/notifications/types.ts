import type {
  ChannelMode,
  NotificationChannel,
  NotificationDeliveryStatus,
} from "@/lib/supabase/database.types";

export type { ChannelMode, NotificationChannel, NotificationDeliveryStatus };

/**
 * Domain Event → Notification Event (Prompt 20). Chaque variante porte
 * exactement les données nécessaires au rendu du template — jamais un
 * objet métier complet (la transaction entière, etc.) pour garder le
 * moteur découplé du domaine qui l'appelle.
 */
export type NotificationEventType = "transaction_settled" | "transaction_failed";

export interface TransactionSettledData {
  reference: string;
  amount: number;
  currency: string;
  direction: "sent" | "received";
}

export interface TransactionFailedData {
  reference: string;
  amount: number;
  currency: string;
  /** OrchestratorErrorCode, en string pour ne pas coupler ce domaine à payments/. */
  reasonCode: string;
}

export type NotificationEvent =
  | { type: "transaction_settled"; userId: string; data: TransactionSettledData }
  | { type: "transaction_failed"; userId: string; data: TransactionFailedData };

export interface DeliveryOutcome {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  mode: ChannelMode;
  error?: string;
}

export interface NotificationDispatchResult {
  /** null si aucune notification n'a été créée (préférences désactivées, échec inattendu). */
  notificationId: string | null;
  deliveries: DeliveryOutcome[];
}
