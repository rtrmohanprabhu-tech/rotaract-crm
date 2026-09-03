import * as React from 'react';
import Link from 'next/link';
import { cn, initials } from '@/lib/utils';
import { Button } from './button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      {icon ? <div className="mb-3 rounded-full bg-brand-50 p-3 text-brand-600">{icon}</div> : null}
      <p className="text-base font-semibold text-ink-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="mt-5">
          <Button>{actionLabel}</Button>
        </Link>
      ) : null}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn('rounded-full object-cover ring-1 ring-ink-200', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cn('inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'warning' | 'success' | 'danger';
  href?: string;
}) {
  const tones = {
    default: 'text-ink-800',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    danger: 'text-red-600',
  } as const;

  const body = (
    <div className="card h-full p-4 transition hover:shadow-pop sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon ? <span className="text-ink-300">{icon}</span> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums sm:text-3xl', tones[tone])}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block focus-visible:rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-800">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 90 ? 'bg-emerald-500' : clamped >= 60 ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
