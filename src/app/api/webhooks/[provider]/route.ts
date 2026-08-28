import { NextResponse, type NextRequest } from "next/server";
import { processIncomingWebhook } from "@/domains/webhooks";
import { getRequestId } from "@/domains/observability/request-context";
import { logApiRequest } from "@/domains/observability/log-request";
import type { Provider } from "@/lib/supabase/database.types";

const VALID_PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];

/**
 * Point d'entrée générique des webhooks fournisseurs (Prompt 07, câblé
 * réellement au Prompt 25). Toute la logique — signature, idempotence,
 * fraîcheur, ordre, audit — vit dans processIncomingWebhook (testable
 * directement, sans passer par le runtime de route Next.js).
 * Instrumentée (Prompt 27 — API latency/error rate) : requête importante
 * au sens du prompt, request ID propagé par src/proxy.ts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const startedAt = Date.now();
  const requestId = await getRequestId();
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    await logApiRequest({
      requestId,
      method: "POST",
      path: `/api/webhooks/${provider}`,
      statusCode: 404,
      durationMs: Date.now() - startedAt,
      errorMessage: "unknown_provider",
    });
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  const result = await processIncomingWebhook(provider as Provider, payload, signature);

  await logApiRequest({
    requestId,
    method: "POST",
    path: `/api/webhooks/${provider}`,
    statusCode: result.httpStatus,
    durationMs: Date.now() - startedAt,
    errorMessage: result.reason ?? null,
  });

  return NextResponse.json(
    { received: true, status: result.status, ...(result.reason ? { reason: result.reason } : {}) },
    { status: result.httpStatus }
  );
}
