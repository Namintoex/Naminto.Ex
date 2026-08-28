import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogProviderCallParams } from "./types";

/**
 * Journalise un appel au Provider Gateway (Prompt 27 — provider latency,
 * provider errors). Ne lève jamais, même garantie que logApiRequest.
 */
export async function logProviderCall(params: LogProviderCallParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("provider_call_logs").insert({
      request_id: params.requestId ?? null,
      provider: params.provider,
      operation: params.operation,
      duration_ms: params.durationMs,
      success: params.success,
      error_message: params.errorMessage ?? null,
      provider_transaction_id: params.providerTransactionId ?? null,
    });
  } catch (err) {
    console.error("[observability] logProviderCall a échoué", err);
  }
}
