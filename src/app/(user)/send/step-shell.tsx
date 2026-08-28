"use client";

import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/design-system";
import type { ReactNode } from "react";

/** Partagé entre le wizard Send Money et le wizard Transfer (dépôt/retrait) — jamais dupliqué. */
export function StepShell({
  title,
  onBack,
  backLabel,
  children,
}: {
  title: string;
  onBack?: () => void;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="rounded-md p-1 text-text-secondary hover:bg-surface-sunken"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>
        )}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={strong ? "font-medium text-text-primary" : "text-text-primary"}>{value}</span>
    </div>
  );
}
