import "server-only";
import QRCode from "qrcode";

/**
 * Génère un QR code SVG (chaîne de balisage brute) côté serveur —
 * jamais dans le bundle client, pour ne pas y embarquer la bibliothèque
 * `qrcode`. QR non signé (voir Prompt 15, QR Engine, pour le format
 * signé/typé BENEFICIARY/REQUEST/PAYMENT_REQUEST/PREFILLED_PAYMENT) :
 * encode uniquement une valeur publique déjà partageable (identifiant
 * Naminto.Ex, lien de demande) — jamais d'information secrète.
 */
export async function generateQrSvg(value: string, size = 220): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    width: size,
  });
}
