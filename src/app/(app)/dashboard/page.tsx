import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileEdit,
  FolderOpen,
  HeartHandshake,
  IndianRupee,
  PlusCircle,
  Users,
} from 'lucide-react';
import { requireUser } from '@/server/session';
import { getClubSettings } from '@/server/settings';
import { isAdminRole, can } from '@/lib/permissions';
import {
  adminStats,
  avenueBreakdown,
  boardMemberStats,
  monthlySeries,
  pendingReviews,
  reportingHealth,
} from '@/server/analytics';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ProgressBar, SectionHeading, StatCard, Avatar } from '@/components/ui/misc';
import { StatusBadge } from '@/components/ui/badge';
import { EventTable } from '@/components/events/event-table';
import { AvenueBarChart, EventsByMonthChart, PeopleByMonthChart } from '@/components/charts/charts';
import { formatCurrency, formatDate, formatNumber, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireUser();
  const settings = await getClubSettings();
  const admin = isAdminRole(user.role) || user.role === 'DIRECTOR';

  const mine = await boardMemberStats(user);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-0.5 text-2xl font-semibold text-ink-900 sm:text-3xl">
            Welcome, {user.name.replace(/^Rtr\.?\s*/i, '')}
          </h1>
        </div>
        <Link href="/events/new">
          <Button size="lg">
            <PlusCircle className="h-4 w-4" /> Report a new event
          </Button>
        </Link>
      </header>

      {mine.corrections > 0 ? (
        <Link
          href="/my-events?status=CORRECTION_REQUIRED"
          className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-800 transition hover:bg-orange-100"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm">
            <strong>{mine.corrections}</strong> of your reports {mine.corrections === 1 ? 'needs' : 'need'} a correction before
            they can be approved.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}

      {mine.overdue > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <Clock className="h-5 w-5 shrink-0" />
          <span className="text-sm">
            <strong>{mine.overdue}</strong> report{mine.overdue === 1 ? ' is' : 's are'} overdue — the club asks for reports
            within {settings.reportingDeadlineHrs} hours of the event.
          </span>
        </div>
      ) : null}

      {/* Personal cards — every role sees their own work first */}
      <section>
        <SectionHeading title="Your reporting" description="Everything you have filed as chair or author." />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard label="Total events" value={formatNumber(mine.total)} icon={<CalendarDays className="h-4 w-4" />} href="/my-events" />
          <StatCard label="Drafts" value={formatNumber(mine.drafts)} icon={<FileEdit className="h-4 w-4" />} href="/my-events?status=DRAFT" />
          <StatCard label="Submitted" value={formatNumber(mine.submitted)} icon={<ClipboardCheck className="h-4 w-4" />} href="/my-events?status=SUBMITTED,UNDER_REVIEW" />
          <StatCard label="Approved" value={formatNumber(mine.approved)} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} href="/my-events?status=APPROVED" />
          <StatCard
            label="Corrections"
            value={formatNumber(mine.corrections)}
            tone={mine.corrections ? 'warning' : 'default'}
            icon={<AlertTriangle className="h-4 w-4" />}
            href="/my-events?status=CORRECTION_REQUIRED"
          />
        </div>
      </section>

      <section>
        <SectionHeading
          title="My recent events"
          action={
            <Link href="/my-events" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          }
        />
        {mine.recent.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="No events yet"
            description="Your submitted events will appear here. It takes about five minutes to file one."
            actionLabel="+ Report your first event"
            actionHref="/events/new"
          />
        ) : (
          <Card>
            <CardBody>
              <EventTable rows={mine.recent} columns={['avenue', 'participants', 'completeness', 'updated']} />
            </CardBody>
          </Card>
        )}
      </section>

      {admin ? <AdminSection userId={user.id} canReview={can(user, 'event.review')} /> : null}
    </div>
  );
}

async function AdminSection({ canReview }: { userId: string; canReview: boolean }) {
  const user = await requireUser();
  const [stats, series, avenues, health, reviews] = await Promise.all([
    adminStats(),
    monthlySeries(),
    avenueBreakdown(),
    reportingHealth(),
    pendingReviews(user, 6),
  ]);

  return (
    <>
      <section>
        <SectionHeading title={`Club overview · ${stats.yearLabel}`} description="Approved and pending reports across the Rotaract year." />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-7">
          <StatCard label="Total events" value={formatNumber(stats.totalEvents)} href="/events" />
          <StatCard label="This month" value={formatNumber(stats.thisMonth)} />
          <StatCard label="Pending reports" value={formatNumber(stats.pending)} tone={stats.pending ? 'warning' : 'default'} href="/reviews" />
          <StatCard label="Approved" value={formatNumber(stats.approved)} tone="success" href="/events?status=APPROVED" />
          <StatCard label="Participants" value={formatNumber(stats.participants)} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Beneficiaries" value={formatNumber(stats.beneficiaries)} icon={<HeartHandshake className="h-4 w-4" />} />
          <StatCard label="Expenditure" value={formatCurrency(stats.expenditure)} icon={<IndianRupee className="h-4 w-4" />} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Events by month</CardTitle>
          </CardHeader>
          <CardBody>
            <EventsByMonthChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reporting health</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-3xl font-semibold text-ink-900">{health.completedPct}%</span>
                <span className="text-xs text-ink-500">reports approved</span>
              </div>
              <ProgressBar value={health.completedPct} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-ink-50 p-2.5">
                <dt className="text-[11px] uppercase text-ink-500">Pending</dt>
                <dd className="text-lg font-semibold text-ink-800">{health.pending}</dd>
              </div>
              <div className="rounded-xl bg-amber-50 p-2.5">
                <dt className="text-[11px] uppercase text-amber-600">Overdue</dt>
                <dd className="text-lg font-semibold text-amber-700">{health.overdue}</dd>
              </div>
              <div className="rounded-xl bg-emerald-50 p-2.5">
                <dt className="text-[11px] uppercase text-emerald-600">Avg. score</dt>
                <dd className="text-lg font-semibold text-emerald-700">{health.avgCompleteness}%</dd>
              </div>
            </dl>
            {health.membersWithPending.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Members with pending reports</p>
                <ul className="space-y-2">
                  {health.membersWithPending.slice(0, 4).map((entry) => (
                    <li key={entry.user.id} className="flex items-center gap-2.5">
                      <Avatar name={entry.user.name} src={entry.user.image} size={28} />
                      <span className="flex-1 truncate text-sm text-ink-700">{entry.user.name}</span>
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{entry.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-emerald-700">Every event on record has been reported. 🎉</p>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events by avenue of service</CardTitle>
          </CardHeader>
          <CardBody>
            <AvenueBarChart data={avenues} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participants &amp; beneficiaries</CardTitle>
          </CardHeader>
          <CardBody>
            <PeopleByMonthChart data={series} />
          </CardBody>
        </Card>
      </section>

      {canReview ? (
        <section>
          <SectionHeading
            title="Pending reports"
            description={`${reviews.length} report${reviews.length === 1 ? '' : 's'} waiting for your review.`}
            action={
              <Link href="/reviews" className="text-sm font-medium text-brand-600 hover:underline">
                Open review queue
              </Link>
            }
          />
          {reviews.length === 0 ? (
            <EmptyState title="Nothing waiting" description="Submitted reports will show up here for review." />
          ) : (
            <Card>
              <CardBody className="divide-y divide-ink-100 p-0">
                {reviews.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-ink-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-800">{event.eventName}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {event.eventId} · {event.avenue.name} · {formatDate(event.eventDate)} ·{' '}
                        {event.chair?.name ?? event.createdBy.name}
                      </p>
                    </div>
                    <span className="text-xs text-ink-400">{event.submittedAt ? `submitted ${relativeTime(event.submittedAt)}` : ''}</span>
                    <StatusBadge status={event.status} />
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </section>
      ) : null}
    </>
  );
}
