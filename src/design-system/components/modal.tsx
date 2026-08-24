"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export function ModalContent({
  className,
  title,
  description,
  children,
}: {
  className?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-surface-overlay" />
      <Dialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border-default bg-surface-raised p-6 shadow-ds-lg focus:outline-none",
          className
        )}
      >
        <Dialog.Title className="text-base font-semibold text-text-primary">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-1 text-sm text-text-secondary">
            {description}
          </Dialog.Description>
        )}
        {children && <div className="mt-4">{children}</div>}
        <Dialog.Close
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Fermer"
        >
          <X className="size-4" aria-hidden />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
