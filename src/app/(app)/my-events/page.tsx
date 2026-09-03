import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import { requireUser } from '@/server/session';
import { searchEvents } from '@/server/search';
import { eventSearchSchema } from '@/lib/validation';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { EventTable } from '@/components/events/event-table';
import { Button } from '@/components/ui/button';
import { STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My events' };

const TABS: Array<{ label: string; status?: string }> = [
  { label: 'All' },
  { label: 'Drafts', status: 'DRAFT' },
  { label: 'Submitted', status: 'SUBMITTED,UNDER_REVIEW' },
  { label: 'Corrections', status: 'CORRECTION_REQUIRED' },
  { label: 'Approved', status: 'APPROVED' },
];

function statusLabel(value: string) {
  const first = value.split(',')[0] as keyof typeof STATUS_LABELS;
  return (STATUS_LABELS[first] ?? '').toLowerCase();
}

export default async function MyEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const query = eventSearchSchema.parse({
    ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
    mine: '1',
  });
  const { rows, total } = await searchEvents(query, user);
  const activeStatus = typeof raw.status === 'string' ? raw.status : '';

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">My events</h1>
          <p className="mt-1 text-sm text-ink-500">
            {total} report{total === 1 ? '' : 's'} you created or chaired.
          </p>
        </div>
        <Link href="/events/new">
          <Button>Report an event</Button>
        </Link>
      </header>

      <div className="mb-4 flex gap-2 overflow-x-auto scroll-area pb-1">
        {TABS.map((tab) => {
          const active = (tab.status ?? '') === activeStatus;
          return (
            <Link
              key={tab.label}
              href={tab.status ? `/my-events?status=${tab.status}` : '/my-events'}
              className={cn(
                'whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition',
                active ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title={activeStatus ? `No ${statusLabel(activeStatus)} reports` : 'No events yet'}
          description="Your submitted events will appear here."
          actionLabel="+ Report your first event"
          actionHref="/events/new"
        />
      ) : (
        <Card>
          <CardBody>
            <EventTable rows={rows} columns={['avenue', 'participants', 'completeness', 'updated', 'drive']} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
