'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BENEFICIARY_LABELS, STATUS_LABELS } from '@/lib/constants';
import type { EventStatus } from '@/generated/prisma/enums';

export function EventFilters({
  avenues,
  members,
  projects,
  canExport,
  total,
}: {
  avenues: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  canExport: boolean;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const value = (key: string) => params.get(key) ?? '';

  function update(key: string, next: string) {
    const search = new URLSearchParams(params.toString());
    if (next) search.set(key, next);
    else search.delete(key);
    search.delete('page');
    router.push(`${pathname}?${search.toString()}`);
  }

  const activeCount = ['status', 'avenueId', 'chairId', 'projectId', 'month', 'beneficiary', 'from', 'to'].filter((k) =>
    params.get(k),
  ).length;

  const exportHref = `/api/export?${new URLSearchParams(params.toString()).toString()}`;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            update('q', String(data.get('q') ?? ''));
          }}
        >
          <label htmlFor="event-search" className="sr-only">
            Search events
          </label>
          <input
            id="event-search"
            name="q"
            defaultValue={value('q')}
            placeholder="Search by name, ID, chair, venue or partner…"
            className="input-base"
          />
        </form>
        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Filter className="h-4 w-4" /> Filters
          {activeCount ? <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{activeCount}</span> : null}
        </Button>
        {canExport ? (
          <>
            <a href={`${exportHref}&format=csv`} className="hidden sm:block">
              <Button type="button" variant="ghost">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </a>
            <a href={`${exportHref}&format=xlsx`}>
              <Button type="button" variant="ghost">
                <Download className="h-4 w-4" /> Excel
              </Button>
            </a>
          </>
        ) : null}
      </div>

      {open ? (
        <div className="grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="field-label">Status</span>
            <select className="input-base" value={value('status')} onChange={(e) => update('status', e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="field-label">Avenue</span>
            <select className="input-base" value={value('avenueId')} onChange={(e) => update('avenueId', e.target.value)}>
              <option value="">All avenues</option>
              {avenues.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="field-label">Chair</span>
            <select className="input-base" value={value('chairId')} onChange={(e) => update('chairId', e.target.value)}>
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="field-label">Project</span>
            <select className="input-base" value={value('projectId')} onChange={(e) => update('projectId', e.target.value)}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="field-label">Month</span>
            <input type="month" className="input-base" value={value('month')} onChange={(e) => update('month', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="field-label">Beneficiary group</span>
            <select className="input-base" value={value('beneficiary')} onChange={(e) => update('beneficiary', e.target.value)}>
              <option value="">Any</option>
              {Object.entries(BENEFICIARY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="field-label">From</span>
            <input type="date" className="input-base" value={value('from')} onChange={(e) => update('from', e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="field-label">To</span>
            <input type="date" className="input-base" value={value('to')} onChange={(e) => update('to', e.target.value)} />
          </label>

          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>
              <X className="h-4 w-4" /> Clear all filters
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-ink-500">
        {total} event{total === 1 ? '' : 's'} found
        {params.get('q') ? ` for “${params.get('q')}”` : ''}
      </p>
    </div>
  );
}

export function statusFromParam(value?: string | null): EventStatus[] | undefined {
  if (!value) return undefined;
  return value.split(',').filter(Boolean) as EventStatus[];
}
