"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

const sideClasses = {
  left: "inset-y-0 left-0 h-full w-[85vw] max-w-xs border-r",
  right: "inset-y-0 right-0 h-full w-[85vw] max-w-xs border-l",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-lg border-t",
} as const;

export function SheetContent({
  className,
  side = "left",
  title,
  children,
}: {
  className?: string;
  side?: keyof typeof sideClasses;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-surface-overlay" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-border-default bg-surface-raised p-5 shadow-ds-lg focus:outline-none",
          sideClasses[side],
          className
        )}
      >
        <div className="flex items-center justify-between">
          <Dialog.Title className="text-base font-semibold text-text-primary">
            {title}
          </Dialog.Title>
          <Dialog.Close
            className="rounded-md p-1 text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
