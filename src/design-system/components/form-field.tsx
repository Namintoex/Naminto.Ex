import * as Label from "@radix-ui/react-label";
import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

const fieldControlClasses =
  "w-full rounded-md border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger";

type FieldShellProps = {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  htmlFor: string;
  children: ReactNode;
};

function FieldShell({ label, helperText, errorText, required, htmlFor, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label.Root htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
          {label}
          {required && <span className="text-danger"> *</span>}
        </Label.Root>
      )}
      {children}
      {errorText ? (
        <p className="text-xs text-danger" role="alert">
          {errorText}
        </p>
      ) : helperText ? (
        <p className="text-xs text-text-secondary">{helperText}</p>
      ) : null}
    </div>
  );
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">,
    Omit<FieldShellProps, "children" | "htmlFor"> {
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, errorText, required, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <FieldShell
        label={label}
        helperText={helperText}
        errorText={errorText}
        required={required}
        htmlFor={inputId}
      >
        <input
          ref={ref}
          id={inputId}
          className={cn(fieldControlClasses, className)}
          aria-invalid={Boolean(errorText)}
          required={required}
          {...props}
        />
      </FieldShell>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">,
    Omit<FieldShellProps, "children" | "htmlFor"> {
  id?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helperText, errorText, required, id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    return (
      <FieldShell
        label={label}
        helperText={helperText}
        errorText={errorText}
        required={required}
        htmlFor={textareaId}
      >
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(fieldControlClasses, "resize-y", className)}
          aria-invalid={Boolean(errorText)}
          required={required}
          {...props}
        />
      </FieldShell>
    );
  }
);
Textarea.displayName = "Textarea";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">,
    Omit<FieldShellProps, "children" | "htmlFor"> {
  id?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helperText, errorText, required, id, options, placeholder, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    return (
      <FieldShell
        label={label}
        helperText={helperText}
        errorText={errorText}
        required={required}
        htmlFor={selectId}
      >
        <select
          ref={ref}
          id={selectId}
          className={cn(fieldControlClasses, "cursor-pointer", className)}
          aria-invalid={Boolean(errorText)}
          required={required}
          {...(props.value === undefined ? { defaultValue: props.defaultValue ?? "" } : {})}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }
);
Select.displayName = "Select";
