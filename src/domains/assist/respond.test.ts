import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { getAssistResponse } from "./respond";

/**
 * Test d'intégration contre le vrai projet Supabase — couvre les
 * intentions qui ne dépendent pas du client RLS (`next/headers` ne peut
 * pas s'exécuter hors du runtime Next.js, voir queries.ts) : menu,
 * sensitive_request, explain_fees (Fee Engine réel, service_role),
 * guide, unknown. diagnose_transaction/search_transaction/create_ticket
 * sont vérifiées manuellement dans le navigateur, comme le reste des
 * lectures RLS-scopées de ce dépôt (history/queries.ts,
 * money-requests/queries.ts n'ont pas non plus de test Vitest dédié).
 */
describe("Naminto Assist — getAssistResponse (intégration, intentions non-RLS)", () => {
  const userId = randomUUID();

  it("menu : propose des actions utiles", async () => {
    const response = await getAssistResponse("bonjour", userId);
    expect(response.intent).toBe("menu");
    expect(response.suggestedActions?.length).toBeGreaterThan(0);
  });

  it("sensitive_request : ne traite jamais une mention de secret", async () => {
    const response = await getAssistResponse("quel est mon code pin ?", userId);
    expect(response.intent).toBe("sensitive_request");
    expect(response.sensitiveReason).toBe("secret");
    expect(response.suggestedActions?.[0]?.href).toBe("/security/pin");
  });

  it("sensitive_request : ne traite jamais une tentative de transfert", async () => {
    const response = await getAssistResponse("envoie 5000 à Paul", userId);
    expect(response.intent).toBe("sensitive_request");
    expect(response.sensitiveReason).toBe("transfer_attempt");
    expect(response.suggestedActions?.[0]?.href).toBe("/send");
  });

  it("explain_fees : calcule un frais réel via le Fee Engine (pas une valeur inventée)", async () => {
    const response = await getAssistResponse("combien coûtent les frais pour 10000 ?", userId);
    expect(response.intent).toBe("explain_fees");
    expect(response.fee).not.toBeNull();
    expect(response.fee).not.toBeUndefined();
    // Règle de repli 3,5 % XOF (0006_fee_rules.sql) : 10 000 × 3,5 % = 350.
    expect(response.fee?.fee).toBeCloseTo(350);
    expect(response.fee?.amount).toBe(10_000);
  });

  it("explain_fees : sans montant, invite à en préciser un plutôt que d'inventer un chiffre", async () => {
    const response = await getAssistResponse("je ne comprends pas les frais", userId);
    expect(response.intent).toBe("explain_fees");
    expect(response.fee).toBeUndefined();
  });

  it("explain_status : renvoie le statut détecté tel quel", async () => {
    const response = await getAssistResponse("pourquoi ma transaction est rejetée ?", userId);
    expect(response.intent).toBe("explain_status");
    expect(response.status).toBe("rejected");
  });

  it("guide : renvoie un thème et une action suggérée cohérente", async () => {
    const response = await getAssistResponse("comment recevoir de l'argent", userId);
    expect(response.intent).toBe("guide");
    expect(response.topic).toBe("receive");
    expect(response.suggestedActions?.[0]?.href).toBe("/receive");
  });

  it("unknown : propose la création d'un ticket plutôt que de rester sans réponse", async () => {
    const response = await getAssistResponse("azerty qwerty 12345", userId);
    expect(response.intent).toBe("unknown");
    expect(response.offerTicket).toBe(true);
  });
});
