import type { Locale } from "@/lib/supabase/database.types";
import type { NotificationEvent } from "./types";

export interface RenderedTemplate {
  title: string;
  body: string;
}

function formatAmount(amount: number, currency: string, locale: Locale): string {
  const formatted = amount.toLocaleString(locale === "fr" ? "fr-FR" : "en-US");
  return `${formatted} ${currency}`;
}

/**
 * Raisons FR/EN pour un échec — mêmes codes que ORCHESTRATOR_ERROR_KEYS
 * (money-requests/actions.ts, send-money-wizard.tsx), reformulés en texte
 * plutôt qu'en clé i18n : ce contenu est persisté tel quel dans
 * `notifications.body`, pas rendu à la volée côté client.
 */
const FAILURE_REASONS: Record<string, { fr: string; en: string }> = {
  VALIDATION_ERROR: { fr: "la demande était invalide.", en: "the request was invalid." },
  RISK_REJECTION: { fr: "un risque élevé a été détecté.", en: "elevated risk was detected." },
  FRAUD_BLOCKED: { fr: "une règle anti-fraude l'a bloquée.", en: "a fraud rule blocked it." },
  MANUAL_REVIEW_REQUIRED: { fr: "une revue manuelle est requise.", en: "manual review is required." },
  COMPLIANCE_REJECTION: {
    fr: "une vérification d'identité supplémentaire est requise.",
    en: "additional identity verification is required.",
  },
  LIMIT_ERROR: { fr: "une limite configurée a été dépassée.", en: "a configured limit was exceeded." },
  PROVIDER_ERROR: { fr: "le fournisseur a rencontré une erreur.", en: "the provider encountered an error." },
  TIMEOUT: { fr: "l'opération a expiré.", en: "the operation timed out." },
  SYSTEM_ERROR: { fr: "une erreur technique est survenue.", en: "a technical error occurred." },
};

function failureReason(code: string, locale: Locale): string {
  const entry = FAILURE_REASONS[code];
  if (entry) return entry[locale];
  return locale === "fr" ? "une erreur est survenue." : "an error occurred.";
}

/**
 * Notification Event → Template (Prompt 20). Une fonction par type
 * d'événement plutôt qu'une table de correspondance : plus simple à lire
 * et à étendre pour les deux langues supportées (fr/en, Prompt 04).
 */
export function renderTemplate(event: NotificationEvent, locale: Locale): RenderedTemplate {
  switch (event.type) {
    case "transaction_settled": {
      const { amount, currency, reference, direction } = event.data;
      const amountStr = formatAmount(amount, currency, locale);
      if (locale === "fr") {
        return direction === "sent"
          ? { title: "Envoi confirmé", body: `Vous avez envoyé ${amountStr} (réf. ${reference}).` }
          : { title: "Argent reçu", body: `Vous avez reçu ${amountStr} (réf. ${reference}).` };
      }
      return direction === "sent"
        ? { title: "Transfer confirmed", body: `You sent ${amountStr} (ref. ${reference}).` }
        : { title: "Money received", body: `You received ${amountStr} (ref. ${reference}).` };
    }

    case "transaction_failed": {
      const { amount, currency, reference, reasonCode } = event.data;
      const amountStr = formatAmount(amount, currency, locale);
      const reason = failureReason(reasonCode, locale);
      if (locale === "fr") {
        return {
          title: "Transfert échoué",
          body: `Votre envoi de ${amountStr} (réf. ${reference}) n'a pas abouti : ${reason}`,
        };
      }
      return {
        title: "Transfer failed",
        body: `Your transfer of ${amountStr} (ref. ${reference}) did not go through: ${reason}`,
      };
    }
  }
}
