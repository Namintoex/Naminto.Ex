import type { TransactionStatus } from "@/domains/payments/transaction-status";
import type { DetectedIntent, GuideTopic } from "./types";

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents pour un matching robuste
    .trim();
}

const REFERENCE_REGEX = /NEX-[A-Z0-9]{4,}/i;
const AMOUNT_REGEX = /\b(\d[\d\s]{2,}\d|\d{3,})\b/;

// Mots qui signalent une question ("comment ça marche") plutôt qu'un
// ordre ("fais-le maintenant") — distingue "comment envoyer de l'argent"
// (guide) de "envoie 5000 à Paul" (tentative d'exécution, bloquée).
const GUIDE_MARKERS = ["comment", "pourquoi", "c'est quoi", "cest quoi", "qu'est-ce", "quest-ce", "how", "why", "what is"];

const SECRET_KEYWORDS = ["pin", "code pin", "mot de passe", "password", "mdp", "secret"];
const SEND_VERBS = ["envoie", "envoyer", "transfere", "transferer", "vire ", "virement", "paye ", "payer "];

const FEE_KEYWORDS = ["frais", "fee", "commission", "combien ca coute", "coute combien", "cout"];
const SEARCH_KEYWORDS = ["retrouve", "cherche", "trouve", "search", "find my transaction"];
const TICKET_KEYWORDS = ["ticket", "support", "agent humain", "parler a un humain", "reclamation", "plainte", "contacter le support"];
const MENU_KEYWORDS = ["bonjour", "salut", "hello", "hi", "aide", "help", "menu"];

const STATUS_KEYWORDS: [string, TransactionStatus][] = [
  ["reglee", "settled"],
  ["regle", "settled"],
  ["settled", "settled"],
  ["echouee", "failed"],
  ["echoue", "failed"],
  ["echec", "failed"],
  ["failed", "failed"],
  ["rejetee", "rejected"],
  ["rejete", "rejected"],
  ["refusee", "rejected"],
  ["refuse", "rejected"],
  ["rejected", "rejected"],
  ["expiree", "expired"],
  ["expire", "expired"],
  ["expired", "expired"],
  ["annulee", "cancelled"],
  ["annule", "cancelled"],
  ["cancelled", "cancelled"],
  ["inversee", "reversed"],
  ["inverse", "reversed"],
  ["reversed", "reversed"],
  ["remboursee", "refunded"],
  ["rembourse", "refunded"],
  ["refunded", "refunded"],
  ["contestee", "disputed"],
  ["conteste", "disputed"],
  ["litige", "disputed"],
  ["disputed", "disputed"],
  ["en cours", "processing"],
  ["processing", "processing"],
  ["en attente", "authentication_required"],
  ["pending", "authentication_required"],
];

const GUIDE_TOPIC_KEYWORDS: [string, GuideTopic][] = [
  ["envoyer", "send"],
  ["envoi", "send"],
  ["send", "send"],
  ["recevoir", "receive"],
  ["receive", "receive"],
  ["demande d'argent", "request"],
  ["demander de l'argent", "request"],
  ["request money", "request"],
  ["compte lie", "accounts"],
  ["compte lié", "accounts"],
  ["orange money", "accounts"],
  ["mtn", "accounts"],
  ["moov", "accounts"],
  ["wave", "accounts"],
  ["linked account", "accounts"],
  ["qr", "qr"],
  ["securite", "security"],
  ["security", "security"],
];

/**
 * Détecte une intention à partir d'un message libre — pattern-matching
 * déterministe, pas une compréhension du langage naturel (voir types.ts).
 * Ordre de priorité volontaire : sécurité d'abord (secret, tentative de
 * transfert), puis les demandes structurées (référence de transaction),
 * puis les mots-clés thématiques, enfin le repli générique.
 */
export function detectIntent(raw: string): DetectedIntent {
  const msg = normalize(raw);

  if (msg.length === 0 || MENU_KEYWORDS.some((k) => msg === k || msg.startsWith(`${k} `))) {
    return { intent: "menu" };
  }

  // Priorité absolue : jamais traité, quelle que soit la formulation —
  // même une question ("comment changer mon mot de passe ?") redirige
  // vers la page sécurisée plutôt que d'être traitée ici.
  if (SECRET_KEYWORDS.some((k) => msg.includes(k))) {
    return { intent: "sensitive_request", sensitiveReason: "secret" };
  }

  const hasSendVerb = SEND_VERBS.some((v) => msg.includes(v));
  const hasGuideMarker = GUIDE_MARKERS.some((g) => msg.includes(g));
  if (hasSendVerb && !hasGuideMarker) {
    // Ordre impératif sans marqueur de question ⇒ tentative d'exécution
    // d'un transfert depuis la conversation — jamais exécuté ici.
    return { intent: "sensitive_request", sensitiveReason: "transfer_attempt" };
  }

  const referenceMatch = raw.match(REFERENCE_REGEX);
  if (referenceMatch) {
    return { intent: "diagnose_transaction", reference: referenceMatch[0].toUpperCase() };
  }

  if (TICKET_KEYWORDS.some((k) => msg.includes(k))) {
    return { intent: "create_ticket" };
  }

  if (FEE_KEYWORDS.some((k) => msg.includes(k))) {
    const amountMatch = msg.match(AMOUNT_REGEX);
    const amount = amountMatch ? Number(amountMatch[0].replace(/\s/g, "")) : undefined;
    return { intent: "explain_fees", amount: amount && amount > 0 ? amount : undefined };
  }

  const statusEntry = STATUS_KEYWORDS.find(([k]) => msg.includes(k));
  if (statusEntry) {
    return { intent: "explain_status", status: statusEntry[1] };
  }
  if (msg.includes("statut") || msg.includes("status") || msg.includes("etat de ma transaction")) {
    return { intent: "explain_status" };
  }

  if (SEARCH_KEYWORDS.some((k) => msg.includes(k))) {
    return { intent: "search_transaction" };
  }

  if (hasSendVerb && hasGuideMarker) {
    return { intent: "guide", topic: "send" };
  }
  const topicEntry = GUIDE_TOPIC_KEYWORDS.find(([k]) => msg.includes(k));
  if (topicEntry) {
    return { intent: "guide", topic: topicEntry[1] };
  }

  return { intent: "unknown" };
}
