import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-5 animate-spin text-brand", className)} aria-hidden />
      {label && <span className="text-sm text-text-secondary">{label}</span>}
      {!label && <span className="sr-only">Chargement</span>}
    </div>
  );
}
