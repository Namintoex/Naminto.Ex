import { NextResponse, type NextRequest } from "next/server";
import { getProviderAdapter } from "@/domains/providers/registry";
import type { Provider } from "@/lib/supabase/database.types";

const VALID_PROVIDERS: Provider[] = ["orange", "mtn", "moov", "wave", "prepaid_card"];

/**
 * Point d'entrée générique des webhooks fournisseurs (Prompt 07).
 * En mode SANDBOX, aucun fournisseur réel n'appelle jamais cette route —
 * elle démontre le contrat de l'interface ProviderAdapter. La
 * persistance des événements (idempotence, rejeu contrôlé) est prévue
 * au Prompt 25 (Webhooks), une fois le domaine Transaction (Prompt 08)
 * disponible pour les rattacher à une opération réelle.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  const adapter = getProviderAdapter(provider as Provider);
  const event = await adapter.verifyAndParseWebhook(payload, signature);

  console.info("[webhook]", provider, event.type);

  return NextResponse.json({ received: true });
}
