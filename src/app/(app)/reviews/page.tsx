import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ClipboardCheck } from 'lucide-react';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/server/search';
import { getClubSettings } from '@/server/settings';
import { overdueCutoff } from '@/server/events';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { EmptyState, ProgressBar } from '@/components/ui/misc';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pending reviews' };

export default async function ReviewsPage() {
  const user = await requireUser();
  if (!can(user, 'event.review')) redirect('/dashboard');

  const settings = await getClubSettings();

  const [queue, overdue] = await Promise.all([
    prisma.event.findMany({
      where: { AND: [{ deletedAt: null, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }, visibilityWhere(user)] },
      include: {
        avenue: true,
        chair: { select: { name: true } },
        createdBy: { select: { name: true } },
        photos: { select: { id: true } },
      },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.event.findMany({
      where: {
        AND: [
          {
            deletedAt: null,
            status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] },
            eventDate: { lt: overdueCutoff(settings.reportingDeadlineHrs) },
          },
          visibilityWhere(user),
        ],
      },
      include: { avenue: true, createdBy: { select: { name: true, email: true } } },
      orderBy: { eventDate: 'asc' },
      take: 25,
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Pending reviews</h1>
        <p className="mt-1 text-sm text-ink-500">
          {queue.length} report{queue.length === 1 ? '' : 's'} awaiting review
          {user.role === 'DIRECTOR' ? ' in your avenue' : ''}.
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="Nothing to review"
          description="Submitted reports appear here. You will also get a notification."
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-ink-100 p-0">
            {queue.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block px-5 py-4 transition hover:bg-ink-50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-800">{event.eventName}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {event.eventId} · {event.avenue.name} · {formatDate(event.eventDate)} ·{' '}
                      {event.chair?.name ?? event.createdBy.name} · {event.photos.length} photos
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-400">
                      {event.submittedAt ? `submitted ${relativeTime(event.submittedAt)}` : ''}
                    </span>
                    <StatusBadge status={event.status} />
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <ProgressBar value={event.completeness} className="max-w-xs" />
                  <span className="text-xs tabular-nums text-ink-500">{event.completeness}% complete</span>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Overdue reports
            </CardTitle>
            <span className="text-sm text-ink-500">Due within {settings.reportingDeadlineHrs} h of the event</span>
          </CardHeader>
          <CardBody>
            {overdue.length === 0 ? (
              <p className="text-sm text-emerald-700">Nothing overdue. The board is on top of its reporting.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {overdue.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/events/${event.id}`} className="truncate font-medium text-ink-800 hover:text-brand-600">
                        {event.eventName}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {event.avenue.name} · held {formatDate(event.eventDate)} · {event.createdBy.name}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
