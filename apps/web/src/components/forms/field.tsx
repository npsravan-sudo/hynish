import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string;
  children: React.ReactNode;
}

/** Accessible form field: label, control, inline hint and error (§38, §44). */
export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden> *</span>}
      </Label>
      <div aria-describedby={describedBy}>{children}</div>
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
