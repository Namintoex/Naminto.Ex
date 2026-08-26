import { describe, expect, it } from "vitest";
import { renderTemplate } from "./templates";
import type { NotificationEvent } from "./types";

describe("renderTemplate", () => {
  it("transaction_settled (sent, fr) mentionne le montant et la référence", () => {
    const event: NotificationEvent = {
      type: "transaction_settled",
      userId: "u1",
      data: { reference: "NEX-ABC123", amount: 5000, currency: "XOF", direction: "sent" },
    };
    const { title, body } = renderTemplate(event, "fr");
    expect(title).toBe("Envoi confirmé");
    // Séparateur de milliers fr-FR : espace fine insécable (U+202F), pas un espace normal.
    expect(body).toContain(`${(5000).toLocaleString("fr-FR")} XOF`);
    expect(body).toContain("NEX-ABC123");
  });

  it("transaction_settled (received, en) utilise le texte anglais", () => {
    const event: NotificationEvent = {
      type: "transaction_settled",
      userId: "u1",
      data: { reference: "NEX-ABC123", amount: 5000, currency: "XOF", direction: "received" },
    };
    const { title, body } = renderTemplate(event, "en");
    expect(title).toBe("Money received");
    expect(body).toContain("5,000 XOF");
  });

  it("transaction_failed (fr) traduit un code d'erreur connu", () => {
    const event: NotificationEvent = {
      type: "transaction_failed",
      userId: "u1",
      data: { reference: "NEX-XYZ789", amount: 1000, currency: "XOF", reasonCode: "COMPLIANCE_REJECTION" },
    };
    const { title, body } = renderTemplate(event, "fr");
    expect(title).toBe("Transfert échoué");
    expect(body).toContain("vérification d'identité supplémentaire");
  });

  it("transaction_failed (en) retombe sur un message générique pour un code inconnu", () => {
    const event: NotificationEvent = {
      type: "transaction_failed",
      userId: "u1",
      data: { reference: "NEX-XYZ789", amount: 1000, currency: "XOF", reasonCode: "SOME_FUTURE_CODE" },
    };
    const { body } = renderTemplate(event, "en");
    expect(body).toContain("an error occurred");
  });
});
