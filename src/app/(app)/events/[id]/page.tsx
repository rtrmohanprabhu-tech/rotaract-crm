import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  FolderSync,
  Lock,
  Pencil,
  Users,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/session';
import { canApproveEvent, canDeleteEvent, canEditEvent, canReviewEvent, canViewEvent, can } from '@/lib/permissions';
import { eventInclude, type EventWithRelations } from '@/server/events';
import { auditTrail } from '@/server/audit';
import { getClubSettings } from '@/server/settings';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, ProgressBar } from '@/components/ui/misc';
import { PhotoGallery } from '@/features/events/gallery';
import { CommentForm, ReviewPanel } from '@/features/events/review-panel';
import { DeleteButton, DriveRetryButton, GenerateReportButton, SubmitButton, UnlockButton } from '@/features/events/event-actions';
import {
  BENEFICIARY_LABELS,
  DOCUMENT_LABELS,
  EVENT_TYPE_LABELS,
  FUNDING_LABELS,
  ORG_TYPE_LABELS,
  SOCIAL_LABELS,
} from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatTime, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id }, select: { eventName: true, eventId: true } });
  return { title: event ? `${event.eventName} · ${event.eventId}` : 'Event' };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-ink-100 py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-52 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-800">{children}</dd>
    </div>
  );
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; locked?: string }>;
}) {
  const { id } = await params;
  const { submitted, locked } = await searchParams;
  const user = await requireUser();

  const event = (await prisma.event.findUnique({ where: { id }, include: eventInclude })) as EventWithRelations | null;
  if (!event || (event.deletedAt && user.role !== 'SUPER_ADMIN')) notFound();
  if (!canViewEvent(user, event)) notFound();

  const [settings, comments, history, audit] = await Promise.all([
    getClubSettings(),
    prisma.eventComment.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true, image: true, role: true } } },
    }),
    prisma.eventStatusHistory.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { name: true, image: true } } },
    }),
    auditTrail('event', id, 25),
  ]);

  const mayEdit = canEditEvent(user, event);
  const mayReview = canReviewEvent(user, event);
  const mayApprove = canApproveEvent(user, event);
  const mayGenerate = can(user, 'report.generate');
  const latestReport = event.reports[0];
  const isOwner = event.createdById === user.id || event.chairId === user.id;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {submitted ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Report submitted successfully.</p>
            <p className="mt-0.5 text-sm">
              Your event ID is <strong>{event.eventId}</strong>. Reviewers have been notified and the Google Drive folder is
              being prepared.
            </p>
          </div>
        </div>
      ) : null}

      {locked ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">This report is locked for editing. Ask the President or an admin to unlock it.</p>
        </div>
      ) : null}

      {event.status === 'CORRECTION_REQUIRED' && isOwner ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="flex items-center gap-2 font-medium text-orange-800">
            <AlertTriangle className="h-5 w-5" /> Correction required
          </p>
          {comments.length ? (
            <p className="mt-1.5 text-sm text-orange-800">“{comments[comments.length - 1].body}”</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/events/${event.id}/edit`}>
              <Button size="sm">
                <Pencil className="h-4 w-4" /> Edit report
              </Button>
            </Link>
            <SubmitButton eventId={event.id} label="Resubmit" />
          </div>
        </div>
      ) : null}

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-ink-900 sm:text-3xl">{event.eventName}</h1>
            <StatusBadge status={event.status} />
            {event.lockedForEdits ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                <Lock className="h-3.5 w-3.5" /> locked
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-ink-500">
            {event.eventId} · {event.avenue.name} · {formatDate(event.eventDate)}
            {event.startTime ? ` · ${formatTime(event.startTime)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {event.driveFolder?.folderUrl ? (
            <a href={event.driveFolder.folderUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open Google Drive
              </Button>
            </a>
          ) : null}
          {mayEdit ? (
            <Link href={`/events/${event.id}/edit`}>
              <Button variant="secondary">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </Link>
          ) : null}
          {isOwner && (event.status === 'DRAFT' || event.status === 'CORRECTION_REQUIRED') ? (
            <SubmitButton eventId={event.id} />
          ) : null}
          {event.status === 'APPROVED' && can(user, 'event.unlock') ? <UnlockButton eventId={event.id} /> : null}
          {canDeleteEvent(user, event) ? <DeleteButton eventId={event.id} /> : null}
        </div>
      </header>

      {/* Overview stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Participants', value: formatNumber(event.totalParticipants), icon: <Users className="h-4 w-4" /> },
          { label: 'Beneficiaries', value: formatNumber(event.totalBeneficiaries) },
          { label: 'Cost', value: formatCurrency(Number(event.eventCost), event.currency) },
          { label: 'Completeness', value: `${event.completeness}%` },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{stat.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Event details</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <Row label="Event chair">{event.chair?.name ?? event.chairNameText ?? '—'}</Row>
                {event.secretary ? <Row label="Event secretary">{event.secretary.name}</Row> : null}
                {event.director ? <Row label="Project lead / director">{event.director.name}</Row> : null}
                <Row label="Avenue of service">{event.avenue.name}</Row>
                <Row label="Event type">{EVENT_TYPE_LABELS[event.eventType]}</Row>
                <Row label="Date &amp; time">
                  {formatDate(event.eventDate)}
                  {event.startTime ? ` · ${formatTime(event.startTime)}` : ''}
                  {event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                </Row>
                <Row label="Venue / platform">
                  {event.eventType === 'ONLINE'
                    ? (event.platform ?? '—')
                    : [event.venue, event.address, event.city, event.state].filter(Boolean).join(', ') || '—'}
                </Row>
                <Row label="Project with">{event.projectWith || 'SELF'}</Row>
                {event.project || event.projectName ? (
                  <Row label="Project">
                    {event.project ? (
                      <Link href={`/projects/${event.project.id}`} className="text-brand-600 hover:underline">
                        {event.project.name}
                      </Link>
                    ) : (
                      event.projectName
                    )}
                    {event.phaseNumber ? ` — Phase ${event.phaseNumber}` : ''}
                  </Row>
                ) : null}
                <Row label="Filed by">
                  {event.createdBy.name} · {relativeTime(event.createdAt)}
                </Row>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participation &amp; beneficiaries</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Rotaractors', event.rotaractorsPresent],
                  ['Rotarians', event.rotariansPresent],
                  ['Council', event.councilPresent],
                  ['Guests', event.guestsPresent],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-xl bg-ink-50 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-500">{label}</p>
                    <p className="text-xl font-semibold text-ink-800 tabular-nums">{formatNumber(value as number)}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-4">
                <Row label="Total participants">{formatNumber(event.totalParticipants)}</Row>
                <Row label="Beneficiary groups">
                  {event.beneficiaries.length
                    ? event.beneficiaries.map((b) => BENEFICIARY_LABELS[b.category]).join(', ')
                    : '—'}
                </Row>
                <Row label="Direct / indirect">
                  {formatNumber(event.directBeneficiaries)} direct · {formatNumber(event.indirectBeneficiaries)} indirect
                </Row>
                {event.beneficiaryNotes ? <Row label="Notes">{event.beneficiaryNotes}</Row> : null}
              </dl>
            </CardBody>
          </Card>

          {event.isCollaboration && event.collaborators.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Collaboration</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="space-y-3">
                  {event.collaborators.map((c) => (
                    <li key={c.id} className="rounded-xl border border-ink-200 p-3">
                      <p className="font-medium text-ink-800">{c.orgName}</p>
                      <p className="text-xs text-ink-500">{ORG_TYPE_LABELS[c.orgType]}</p>
                      {c.contactName || c.contactEmail || c.contactPhone ? (
                        <p className="mt-1 text-sm text-ink-600">
                          {[c.contactName, c.contactEmail, c.contactPhone].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Financials</CardTitle>
            </CardHeader>
            <CardBody>
              <dl>
                <Row label="Total cost">{formatCurrency(Number(event.eventCost), event.currency)}</Row>
                <Row label="Funding source">{event.fundingSource ? FUNDING_LABELS[event.fundingSource] : '—'}</Row>
                {event.sponsorName ? <Row label="Sponsor">{event.sponsorName}</Row> : null}
                {event.expenseNotes ? <Row label="Notes">{event.expenseNotes}</Row> : null}
              </dl>
            </CardBody>
          </Card>

          {event.description ? (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{event.description}</p>
              </CardBody>
            </Card>
          ) : null}

          {event.objective || event.accomplished || event.impact || event.specialOutcome || event.feedback ? (
            <Card>
              <CardHeader>
                <CardTitle>Objective &amp; impact</CardTitle>
              </CardHeader>
              <CardBody>
                <dl>
                  {event.objective ? <Row label="Objective">{event.objective}</Row> : null}
                  {event.accomplished ? <Row label="Accomplished">{event.accomplished}</Row> : null}
                  {event.impact ? <Row label="Impact">{event.impact}</Row> : null}
                  {event.specialOutcome ? <Row label="Special outcome">{event.specialOutcome}</Row> : null}
                  {event.feedback ? <Row label="Feedback">{event.feedback}</Row> : null}
                </dl>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Photographs</CardTitle>
              <span className="text-sm text-ink-500">{event.photos.length} photos</span>
            </CardHeader>
            <CardBody>
              <PhotoGallery
                photos={event.photos.map((p) => ({ id: p.id, caption: p.caption, fileName: p.fileName }))}
              />
            </CardBody>
          </Card>

          {event.documents.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Documents &amp; evidence</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="divide-y divide-ink-100">
                  {event.documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 py-2.5">
                      <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                      <a
                        href={`/api/files/document/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm text-ink-800 hover:text-brand-600"
                      >
                        {doc.fileName}
                      </a>
                      <span className="text-xs text-ink-500">{DOCUMENT_LABELS[doc.category]}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {event.socialLinks.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Published online</CardTitle>
              </CardHeader>
              <CardBody>
                <ul className="flex flex-wrap gap-2">
                  {event.socialLinks.map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1.5 text-sm text-ink-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        {SOCIAL_LABELS[link.platform]} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments &amp; corrections</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-sm text-ink-500">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {comments.map((comment) => (
                    <li key={comment.id} className="flex gap-3">
                      <Avatar name={comment.author.name} src={comment.author.image} size={32} />
                      <div className="min-w-0 flex-1 rounded-xl bg-ink-50 p-3">
                        <p className="text-sm font-medium text-ink-800">
                          {comment.author.name}
                          <span className="ml-2 text-xs font-normal text-ink-400">{relativeTime(comment.createdAt)}</span>
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <CommentForm eventId={event.id} />
            </CardBody>
          </Card>
        </div>

        {/* Side rail */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          {mayReview ? (
            <Card>
              <CardHeader>
                <CardTitle>Review this report</CardTitle>
              </CardHeader>
              <CardBody>
                <ReviewPanel eventId={event.id} status={event.status} canApprove={mayApprove} />
              </CardBody>
            </Card>
          ) : null}

          {mayGenerate && (event.status === 'APPROVED' || user.role === 'SUPER_ADMIN') ? (
            <Card>
              <CardHeader>
                <CardTitle>Report PDF</CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                <GenerateReportButton eventId={event.id} existingReportId={latestReport?.id ?? null} />
                {latestReport ? (
                  <p className="text-xs text-ink-500">
                    Last generated {relativeTime(latestReport.createdAt)} · {latestReport.fileName}
                  </p>
                ) : (
                  <p className="text-xs text-ink-500">
                    Builds a branded PDF from the stored data and files it into 06_Generated_Report on Drive.
                  </p>
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Google Drive</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                <FolderSync className="h-4 w-4 text-ink-400" />
                <span
                  className={
                    event.driveSyncStatus === 'SYNCED'
                      ? 'text-emerald-700'
                      : event.driveSyncStatus === 'FAILED'
                        ? 'text-red-600'
                        : 'text-amber-700'
                  }
                >
                  {event.driveSyncStatus === 'SYNCED'
                    ? 'Synced'
                    : event.driveSyncStatus === 'FAILED'
                      ? 'Sync failed'
                      : event.driveSyncStatus === 'SYNCING'
                        ? 'Syncing…'
                        : 'Pending'}
                </span>
              </p>
              {event.driveFolder ? (
                <p className="break-words text-xs text-ink-500">{event.driveFolder.path}</p>
              ) : (
                <p className="text-xs text-ink-500">The folder is created when the report is submitted.</p>
              )}
              {event.driveSyncError ? <p className="text-xs text-red-600">{event.driveSyncError}</p> : null}
              {event.driveFolder?.folderUrl ? (
                <a href={event.driveFolder.folderUrl} target="_blank" rel="noreferrer" className="block">
                  <Button variant="secondary" size="sm" block>
                    <ExternalLink className="h-4 w-4" /> Open folder
                  </Button>
                </a>
              ) : null}
              {can(user, 'drive.manage') && event.driveSyncStatus !== 'SYNCED' && event.status !== 'DRAFT' ? (
                <DriveRetryButton eventId={event.id} />
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report completeness</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="mb-2 text-2xl font-semibold text-ink-900">{event.completeness}%</p>
              <ProgressBar value={event.completeness} />
              <p className="mt-2 text-xs text-ink-500">
                Club policy: at least {settings.minPhotos} photos and a submission within {settings.reportingDeadlineHrs} hours
                of the event.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-3">
                {history.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-300" />
                    <div>
                      <p className="text-sm text-ink-700">
                        {entry.from ? `${entry.from} → ` : ''}
                        <strong>{entry.to}</strong>
                      </p>
                      <p className="text-xs text-ink-500">
                        {entry.actor?.name ?? 'System'} · {formatDateTime(entry.createdAt)}
                      </p>
                      {entry.note ? <p className="mt-0.5 text-xs text-ink-500">“{entry.note}”</p> : null}
                    </div>
                  </li>
                ))}
              </ol>

              {audit.length ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-700">
                    Full audit log ({audit.length})
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {audit.map((entry) => (
                      <li key={entry.id} className="text-xs text-ink-500">
                        {formatDate(entry.createdAt)} — {entry.summary}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
