import { describe, expect, it } from "vitest";
import { detectIntent } from "./intent-detector";

describe("detectIntent — sécurité (Interdictions absolues, Prompt 21)", () => {
  it("bloque toute mention de PIN/mot de passe/secret, même sous forme de question", () => {
    expect(detectIntent("quel est mon code pin").intent).toBe("sensitive_request");
    expect(detectIntent("donne-moi mon mot de passe").intent).toBe("sensitive_request");
    expect(detectIntent("comment changer mon mot de passe ?").intent).toBe("sensitive_request");
    expect(detectIntent("what is my password").intent).toBe("sensitive_request");
    expect(detectIntent("j'ai oublié mon secret").intent).toBe("sensitive_request");
  });

  it("marque la raison 'secret' pour toute mention PIN/mot de passe", () => {
    expect(detectIntent("mon pin c'est 1234").sensitiveReason).toBe("secret");
  });

  it("bloque une tentative d'exécution de transfert (ordre impératif, pas une question)", () => {
    expect(detectIntent("envoie 5000 à Paul").intent).toBe("sensitive_request");
    expect(detectIntent("transfère 10000 vers mon compte orange").intent).toBe("sensitive_request");
    const result = detectIntent("envoie 5000 à Paul");
    expect(result.sensitiveReason).toBe("transfer_attempt");
  });

  it("ne bloque pas une question sur COMMENT envoyer de l'argent (guide, pas exécution)", () => {
    const result = detectIntent("comment envoyer de l'argent ?");
    expect(result.intent).toBe("guide");
    expect(result.topic).toBe("send");
  });

  it("la détection de secret est prioritaire sur toute autre intention", () => {
    // Un message qui ressemblerait à une question de frais mais mentionne aussi le mot de passe.
    expect(detectIntent("les frais avec mon mot de passe ?").intent).toBe("sensitive_request");
  });
});

describe("detectIntent — intentions utiles", () => {
  it("reconnaît une référence de transaction et priorise le diagnostic", () => {
    const result = detectIntent("ma transaction NEX-A1B2C3D4 a échoué, pourquoi ?");
    expect(result.intent).toBe("diagnose_transaction");
    expect(result.reference).toBe("NEX-A1B2C3D4");
  });

  it("reconnaît une demande d'explication des frais avec un montant", () => {
    const result = detectIntent("combien coûtent les frais pour 5000 ?");
    expect(result.intent).toBe("explain_fees");
    expect(result.amount).toBe(5000);
  });

  it("reconnaît une demande d'explication des frais sans montant", () => {
    const result = detectIntent("je ne comprends pas les frais");
    expect(result.intent).toBe("explain_fees");
    expect(result.amount).toBeUndefined();
  });

  it("reconnaît un statut précis mentionné dans le message", () => {
    expect(detectIntent("pourquoi ma transaction est rejetée ?")).toMatchObject({
      intent: "explain_status",
      status: "rejected",
    });
    expect(detectIntent("elle est expirée je crois")).toMatchObject({
      intent: "explain_status",
      status: "expired",
    });
  });

  it("reconnaît une question de statut générique sans statut précis", () => {
    const result = detectIntent("quel est le statut de ma transaction ?");
    expect(result.intent).toBe("explain_status");
    expect(result.status).toBeUndefined();
  });

  it("reconnaît une demande de recherche de transaction", () => {
    expect(detectIntent("je cherche une transaction").intent).toBe("search_transaction");
  });

  it("reconnaît une demande explicite de ticket/support", () => {
    expect(detectIntent("je veux parler à un agent humain").intent).toBe("create_ticket");
    expect(detectIntent("créer un ticket").intent).toBe("create_ticket");
  });

  it("reconnaît les thèmes de guidage", () => {
    expect(detectIntent("comment recevoir de l'argent")).toMatchObject({ intent: "guide", topic: "receive" });
    expect(detectIntent("c'est quoi le QR code")).toMatchObject({ intent: "guide", topic: "qr" });
    expect(detectIntent("comment lier un compte orange money")).toMatchObject({ intent: "guide", topic: "accounts" });
  });

  it("renvoie 'menu' pour une salutation ou un message vide", () => {
    expect(detectIntent("bonjour").intent).toBe("menu");
    expect(detectIntent("").intent).toBe("menu");
    expect(detectIntent("   ").intent).toBe("menu");
  });

  it("renvoie 'unknown' pour un message sans intention reconnue", () => {
    expect(detectIntent("azerty qwerty 12345").intent).toBe("unknown");
  });

  it("ignore les accents et la casse", () => {
    expect(detectIntent("POURQUOI MA TRANSACTION EST ÉCHOUÉE").intent).toBe("explain_status");
  });
});
