import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export const alertVariants = cva("flex gap-3 rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-bg text-text-primary",
      success: "border-success/20 bg-success-bg text-text-primary",
      warning: "border-warning/20 bg-warning-bg text-text-primary",
      danger: "border-danger/20 bg-danger-bg text-text-primary",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const iconColors = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
} as const;

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const Icon = icons[variant ?? "info"];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColors[variant ?? "info"])} aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-medium text-text-primary">{title}</p>}
        {children && <div className="text-text-secondary">{children}</div>}
      </div>
    </div>
  );
}
