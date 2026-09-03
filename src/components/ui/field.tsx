'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function useId(explicit?: string) {
  const generated = React.useId();
  return explicit ?? generated;
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
  className?: string;
  id?: string;
};

/** Every input gets a real <label>, hint and error wiring (§56). */
export function Field({ label, hint, error, required, optional, children, className, id: explicitId }: FieldProps) {
  const id = useId(explicitId);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span className="ml-1 text-brand-600">*</span> : null}
        {optional ? <span className="ml-1 text-xs font-normal text-ink-400">(optional)</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': Boolean(error) })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn('input-base', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('input-base min-h-[120px] resize-y', className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn('input-base appearance-none bg-[right_0.75rem_center] pr-9', className)} {...props}>
        {children}
      </select>
    );
  },
);

export function Toggle({
  checked,
  onChange,
  label,
  description,
  name,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 transition hover:border-ink-300">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-400"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-500">{description}</span> : null}
      </span>
    </label>
  );
}

/** Big, thumb-friendly yes/no used all through the wizard. */
export function YesNo({
  value,
  onChange,
  yesLabel = 'Yes',
  noLabel = 'No',
  name,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
  name?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={name}>
      {[
        { label: yesLabel, val: true },
        { label: noLabel, val: false },
      ].map((option) => (
        <button
          key={option.label}
          type="button"
          role="radio"
          aria-checked={value === option.val}
          onClick={() => onChange(option.val)}
          className={cn(
            'h-12 rounded-xl border text-sm font-medium transition',
            value === option.val
              ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multiple = true,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (value: T[]) => void;
  multiple?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!multiple) return onChange([option.value]);
              onChange(active ? value.filter((v) => v !== option.value) : [...value, option.value]);
            }}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm transition',
              active
                ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
