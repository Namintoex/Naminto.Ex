import "server-only";
import { detectIntent } from "./intent-detector";
import { diagnoseTransaction, explainFeeForAmount, listRecentTransactionsForAssist } from "./queries";
import type { AssistResponse, SuggestedAction } from "./types";

const ACTIONS: Record<string, SuggestedAction> = {
  send: { labelKey: "nav.send", href: "/send" },
  receive: { labelKey: "nav.receive", href: "/receive" },
  request: { labelKey: "nav.request", href: "/request" },
  accounts: { labelKey: "nav.accounts", href: "/accounts" },
  history: { labelKey: "nav.history", href: "/history" },
  security: { labelKey: "nav.security", href: "/security" },
  pin: { labelKey: "security.pin.changeLink", href: "/security/pin" },
};

const GUIDE_TOPIC_ACTION: Record<string, SuggestedAction> = {
  send: ACTIONS.send,
  receive: ACTIONS.receive,
  request: ACTIONS.request,
  accounts: ACTIONS.accounts,
  qr: ACTIONS.receive,
  security: ACTIONS.security,
};

function extractReasonCode(reason: string | null): string | null {
  if (!reason) return null;
  const [code] = reason.split(":");
  return code?.trim() || null;
}

/**
 * Point d'entrée unique de Naminto Assist (Prompt 21) — Domain intent →
 * données réelles → réponse structurée. N'exécute et ne modifie jamais
 * rien de financier : lecture seule sur transactions/fee_rules (RLS),
 * la seule écriture possible dans tout ce domaine est la création d'un
 * ticket (create-ticket.ts), jamais appelée ici.
 */
export async function getAssistResponse(message: string, userId: string): Promise<AssistResponse> {
  const detected = detectIntent(message);

  switch (detected.intent) {
    case "menu":
      return {
        intent: "menu",
        suggestedActions: [ACTIONS.send, ACTIONS.receive, ACTIONS.history, ACTIONS.security],
      };

    case "sensitive_request":
      return {
        intent: "sensitive_request",
        sensitiveReason: detected.sensitiveReason,
        suggestedActions: [detected.sensitiveReason === "secret" ? ACTIONS.pin : ACTIONS.send],
      };

    case "explain_fees": {
      if (detected.amount) {
        const fee = await explainFeeForAmount(detected.amount);
        return { intent: "explain_fees", fee, offerTicket: fee === null };
      }
      return { intent: "explain_fees", fee: undefined, suggestedActions: [ACTIONS.send] };
    }

    case "explain_status":
      return { intent: "explain_status", status: detected.status };

    case "diagnose_transaction": {
      if (!detected.reference) {
        return { intent: "diagnose_transaction", diagnosis: null, offerTicket: true };
      }
      const diagnosis = await diagnoseTransaction(detected.reference, userId);
      if (!diagnosis) {
        return { intent: "diagnose_transaction", diagnosis: null, offerTicket: true };
      }
      const isFailureLike = ["failed", "rejected", "cancelled", "expired", "disputed"].includes(
        diagnosis.transaction.status
      );
      return {
        intent: "diagnose_transaction",
        diagnosis: {
          reference: diagnosis.transaction.reference,
          status: diagnosis.transaction.status,
          amount: Number(diagnosis.transaction.amount),
          currency: diagnosis.transaction.currency,
          reasonCode: extractReasonCode(diagnosis.latestReason),
        },
        offerTicket: isFailureLike,
        suggestedActions: [{ labelKey: "nav.history", href: `/history/${diagnosis.transaction.reference}` }],
      };
    }

    case "search_transaction": {
      const recent = await listRecentTransactionsForAssist(userId);
      return {
        intent: "search_transaction",
        recentTransactions: recent.map((tx) => ({
          reference: tx.reference,
          amount: Number(tx.amount),
          currency: tx.currency,
          status: tx.status,
        })),
        suggestedActions: [ACTIONS.history],
      };
    }

    case "guide": {
      const topic = detected.topic ?? "send";
      return { intent: "guide", topic, suggestedActions: [GUIDE_TOPIC_ACTION[topic] ?? ACTIONS.send] };
    }

    case "create_ticket":
      return { intent: "create_ticket", offerTicket: true };

    case "unknown":
    default:
      return { intent: "unknown", offerTicket: true };
  }
}
