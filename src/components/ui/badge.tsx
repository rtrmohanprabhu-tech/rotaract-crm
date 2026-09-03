import * as React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_STYLES } from '@/lib/constants';
import type { EventStatus } from '@/generated/prisma/enums';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        'bg-ink-100 text-ink-700 ring-ink-200',
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  return (
    <Badge className={cn(STATUS_STYLES[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
