import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LogApiRequestParams } from "./types";

/**
 * Journalise une requête importante (Prompt 27 — API latency, error
 * rate). Ne lève jamais : l'observabilité ne doit jamais devenir un
 * nouveau point de défaillance pour l'opération qu'elle mesure (même
 * garantie que publishEvent, Prompt 26).
 */
export async function logApiRequest(params: LogApiRequestParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("request_logs").insert({
      request_id: params.requestId,
      method: params.method,
      path: params.path,
      status_code: params.statusCode,
      duration_ms: params.durationMs,
      user_id: params.userId ?? null,
      error_message: params.errorMessage ?? null,
    });
  } catch (err) {
    console.error("[observability] logApiRequest a échoué", err);
  }
}
