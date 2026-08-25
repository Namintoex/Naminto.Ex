"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { forwardRef, useId } from "react";
import { cn } from "../lib/cn";

export interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  label?: string;
  description?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, label, description, id, ...props }, ref) => {
    const generatedId = useId();
    const switchId = id ?? generatedId;

    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={switchId}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full bg-surface-sunken outline-none transition-colors data-[state=checked]:bg-brand disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-surface-raised shadow-ds-sm transition-transform data-[state=checked]:translate-x-[18px]" />
      </SwitchPrimitive.Root>
    );

    if (!label) {
      return control;
    }

    return (
      <label htmlFor={switchId} className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">{label}</span>
          {description && <span className="text-xs text-text-secondary">{description}</span>}
        </span>
        {control}
      </label>
    );
  }
);
Switch.displayName = "Switch";
