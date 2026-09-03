import Link from 'next/link';
import { ExternalLink, ImageOff } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatNumber, relativeTime } from '@/lib/utils';
import type { EventStatus } from '@/generated/prisma/enums';

export type EventRow = {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  status: EventStatus;
  updatedAt: Date;
  totalParticipants: number;
  totalBeneficiaries: number;
  eventCost: unknown;
  completeness: number;
  avenue: { name: string; color: string };
  chair?: { name: string } | null;
  chairNameText?: string | null;
  driveFolder?: { folderUrl: string } | null;
  photos?: Array<{ id: string }>;
};

/**
 * One table used by My Events, All Events and the dashboards. On phones each
 * row collapses into a readable card instead of scrolling sideways.
 */
export function EventTable({
  rows,
  columns = ['avenue', 'chair', 'participants', 'beneficiaries', 'cost', 'drive'],
  emptyMessage = 'No events match these filters.',
}: {
  rows: EventRow[];
  columns?: Array<'avenue' | 'chair' | 'participants' | 'beneficiaries' | 'cost' | 'drive' | 'updated' | 'completeness'>;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-ink-200 px-4 py-10 text-center text-sm text-ink-500">{emptyMessage}</p>;
  }

  const show = (key: string) => columns.includes(key as never);

  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/events/${row.id}`} className="block rounded-xl border border-ink-200 bg-white p-3.5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-800">{row.eventName}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {row.eventId} · {formatDate(row.eventDate)}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.avenue.color }} />
                  {row.avenue.name}
                </span>
                <span>{formatNumber(row.totalParticipants)} participants</span>
                <span>{formatNumber(row.totalBeneficiaries)} beneficiaries</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="py-2.5 pr-3 font-medium">Event</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
              {show('avenue') ? <th scope="col" className="px-3 py-2.5 font-medium">Avenue</th> : null}
              {show('chair') ? <th scope="col" className="px-3 py-2.5 font-medium">Chair</th> : null}
              {show('participants') ? <th scope="col" className="px-3 py-2.5 text-right font-medium">People</th> : null}
              {show('beneficiaries') ? <th scope="col" className="px-3 py-2.5 text-right font-medium">Benef.</th> : null}
              {show('cost') ? <th scope="col" className="px-3 py-2.5 text-right font-medium">Cost</th> : null}
              {show('completeness') ? <th scope="col" className="px-3 py-2.5 text-right font-medium">Complete</th> : null}
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              {show('updated') ? <th scope="col" className="px-3 py-2.5 font-medium">Updated</th> : null}
              {show('drive') ? <th scope="col" className="px-3 py-2.5 font-medium">Drive</th> : null}
              <th scope="col" className="py-2.5 pl-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-ink-50/70">
                <td className="max-w-[260px] py-3 pr-3">
                  <Link href={`/events/${row.id}`} className="block">
                    <span className="block truncate font-medium text-ink-800">{row.eventName}</span>
                    <span className="block text-xs text-ink-400">{row.eventId}</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-600">{formatDate(row.eventDate)}</td>
                {show('avenue') ? (
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-ink-600">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.avenue.color }} />
                      {row.avenue.name}
                    </span>
                  </td>
                ) : null}
                {show('chair') ? (
                  <td className="px-3 py-3 text-ink-600">{row.chair?.name ?? row.chairNameText ?? '—'}</td>
                ) : null}
                {show('participants') ? <td className="px-3 py-3 text-right tabular-nums text-ink-600">{formatNumber(row.totalParticipants)}</td> : null}
                {show('beneficiaries') ? <td className="px-3 py-3 text-right tabular-nums text-ink-600">{formatNumber(row.totalBeneficiaries)}</td> : null}
                {show('cost') ? <td className="px-3 py-3 text-right tabular-nums text-ink-600">{formatCurrency(Number(row.eventCost))}</td> : null}
                {show('completeness') ? (
                  <td className="px-3 py-3 text-right tabular-nums text-ink-600">{row.completeness}%</td>
                ) : null}
                <td className="px-3 py-3">
                  <StatusBadge status={row.status} />
                </td>
                {show('updated') ? <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-500">{relativeTime(row.updatedAt)}</td> : null}
                {show('drive') ? (
                  <td className="px-3 py-3">
                    {row.driveFolder?.folderUrl ? (
                      <a
                        href={row.driveFolder.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-azure-600 hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                        <ImageOff className="h-3 w-3" /> —
                      </span>
                    )}
                  </td>
                ) : null}
                <td className="py-3 pl-3 text-right">
                  <Link href={`/events/${row.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
