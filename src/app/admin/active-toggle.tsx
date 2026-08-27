"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Switch } from "@/design-system";

/** Interrupteur actif/inactif partagé par les tables de règles configurables du Back Office (Prompt 22). */
export function ActiveToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (next: boolean) => Promise<unknown>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={(next: boolean) => {
        startTransition(async () => {
          await onToggle(next);
          router.refresh();
        });
      }}
    />
  );
}
