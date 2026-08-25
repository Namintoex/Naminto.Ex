import { cn } from "../lib/cn";

/**
 * Rend un QR code déjà généré côté serveur (voir src/lib/qr.ts) — ce
 * composant ne fait que l'afficher, jamais de génération côté client.
 */
export function QrCode({ svg, className }: { svg: string; className?: string }) {
  return (
    <div
      role="img"
      className={cn("inline-block rounded-md bg-white p-3", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
