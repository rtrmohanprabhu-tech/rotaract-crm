import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { searchEvents } from '@/server/search';
import { eventSearchSchema } from '@/lib/validation';
import { getAvenues, getBoardMembers, getProjects } from '@/server/settings';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { EventTable } from '@/components/events/event-table';
import { EventFilters } from '@/features/events/event-filters';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All events' };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;
  const query = eventSearchSchema.parse(
    Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );

  const [{ rows, total, page, pages }, avenues, members, projects] = await Promise.all([
    searchEvents(query, user),
    getAvenues(),
    getBoardMembers(),
    getProjects(),
  ]);

  const pageHref = (next: number) => {
    const params = new URLSearchParams(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? (v[0] ?? '') : (v ?? '')]),
    );
    params.set('page', String(next));
    return `/events?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">All events</h1>
          <p className="mt-1 text-sm text-ink-500">Every report you have access to, searchable and exportable.</p>
        </div>
        <Link href="/events/new">
          <Button>Report an event</Button>
        </Link>
      </header>

      <EventFilters
        avenues={avenues}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        projects={projects}
        canExport={can(user, 'export.data')}
        total={total}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No events match these filters"
          description="Try clearing a filter, or report a new event."
          actionLabel="+ Report an event"
          actionHref="/events/new"
        />
      ) : (
        <Card>
          <CardBody>
            <EventTable rows={rows} columns={['avenue', 'chair', 'participants', 'beneficiaries', 'cost', 'drive']} />
          </CardBody>
        </Card>
      )}

      {pages > 1 ? (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)}>
              <Button variant="secondary" size="sm">
                Previous
              </Button>
            </Link>
          ) : null}
          <span className="text-sm text-ink-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)}>
              <Button variant="secondary" size="sm">
                Next
              </Button>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
