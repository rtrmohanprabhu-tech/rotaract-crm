/**
 * End-to-end smoke test against a real database.
 *
 *   npm run smoke
 *
 * Walks the acceptance scenario from the brief (§69) without a browser:
 * create → validate → upload evidence → submit → review → correction →
 * resubmit → approve → generate PDF → export. Google Drive is exercised only
 * if it is configured; otherwise the run asserts the graceful-degradation path.
 *
 * Safe to run against a seeded development database: everything it creates is
 * removed at the end.
 */
import '../src/lib/env-first.js'; // must stay first — see that module
import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { createEventDraft, completenessFor, refreshCompleteness, updateEventDraft } from '../src/server/events.js';
import { canApproveEvent, canEditEvent, canReviewEvent, canViewEvent } from '../src/lib/permissions.js';
import { saveUpload, removeStored } from '../src/server/storage/local.js';
import { buildEventReportPdf, buildPeriodReportPdf } from '../src/server/reports/pdf.js';
import { buildCsv, buildXlsx } from '../src/server/export.js';
import { adminStats, monthlySeries, reportingHealth } from '../src/server/analytics.js';
import { searchEvents } from '../src/server/search.js';
import { eventInclude } from '../src/server/events.js';
import { isDriveReady } from '../src/server/drive/client.js';
import { syncEvent } from '../src/server/drive/service.js';

let failures = 0;
function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`, detail ?? '');
  }
}

async function main() {
  console.log('\nRotaract CRM — smoke test\n');

  console.log('Database');
  await prisma.$queryRaw`SELECT 1`;
  const [members, avenues] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true } }),
    prisma.avenue.findMany(),
  ]);
  check('connects and finds seeded members', members.length > 0, members.length);
  check('has avenues configured', avenues.length > 0);

  const board = members.find((m) => m.role === 'BOARD_MEMBER');
  const president = members.find((m) => m.role === 'PRESIDENT');
  const secretary = members.find((m) => m.role === 'SECRETARY');
  if (!board || !president || !secretary) throw new Error('Run `npm run db:seed` first.');
  const communityService = avenues.find((a) => a.name === 'Community Service') ?? avenues[0];

  console.log('\nCreate a draft');
  const draft = await createEventDraft(
    {
      eventName: 'Smoke Test — Care2Cook',
      eventDate: new Date('2026-01-30T00:00:00Z'),
      startTime: '11:30',
      endTime: '13:30',
      eventType: 'PHYSICAL',
      avenueId: communityService.id,
      chairId: board.id,
      venue: 'Sample Location',
      city: 'Coimbatore',
      country: 'India',
      isCollaboration: true,
      projectWith: 'Sample Partner Organization',
      collaborators: [{ orgType: 'COLLEGE', orgName: 'Sample Partner Organization' }],
      rotaractorsPresent: 14,
      rotariansPresent: 0,
      councilPresent: 0,
      guestsPresent: 0,
      beneficiaryCategories: ['SCHOOL_STUDENTS'],
      directBeneficiaries: 60,
      indirectBeneficiaries: 120,
      hasExpenses: true,
      eventCost: 4534,
      fundingSource: 'CLUB_FUND',
      description:
        'We donated equipment to improve the school kitchen and support nutritious meal preparation for the students.',
      socialLinks: [],
      isPartOfProject: false,
    } as never,
    board.id,
  );
  check('generates a sequential event id', /^EVT-2026-\d{4}$/.test(draft.eventId), draft.eventId);
  check('derives total participants', draft.totalParticipants === 14, draft.totalParticipants);
  check('derives total beneficiaries', draft.totalBeneficiaries === 180, draft.totalBeneficiaries);
  check('stores cost as a number, not prose', Number(draft.eventCost) === 4534);

  console.log('\nCompleteness gate');
  const before = await completenessFor(draft.id);
  check('blocks submission until the photo minimum is met', before?.canSubmit === false, before?.missingRequired.map((c) => c.key));

  console.log('\nEvidence upload');
  for (let i = 0; i < 3; i += 1) {
    const buffer = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 205, g: 42, b: 99 } },
    })
      .jpeg()
      .toBuffer();
    const saved = await saveUpload({
      buffer,
      fileName: `smoke-${i + 1}.jpg`,
      mimeType: 'image/jpeg',
      eventId: draft.eventId,
      kind: 'photo',
    });
    await prisma.eventPhoto.create({
      data: {
        eventId: draft.id,
        fileName: saved.fileName,
        mimeType: 'image/jpeg',
        size: saved.size,
        storagePath: saved.storagePath,
        thumbnailPath: saved.thumbnailPath,
        sortOrder: i,
        caption: i === 0 ? 'Distribution of equipment to the school' : null,
      },
    });
  }
  const posterBuffer = await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#1f7ae0' } })
    .png()
    .toBuffer();
  const poster = await saveUpload({
    buffer: posterBuffer,
    fileName: 'poster.png',
    mimeType: 'image/png',
    eventId: draft.eventId,
    kind: 'document',
  });
  await prisma.eventDocument.create({
    data: {
      eventId: draft.id,
      category: 'POSTER',
      fileName: 'poster.png',
      mimeType: 'image/png',
      size: poster.size,
      storagePath: poster.storagePath,
    },
  });
  const after = await refreshCompleteness(draft.id);
  check('unblocks submission once evidence is attached', after?.canSubmit === true, after?.missingRequired);
  check('completeness score rises', (after?.score ?? 0) > (before?.score ?? 0), `${before?.score} → ${after?.score}`);

  console.log('\nPermissions');
  const stored = await prisma.event.findUniqueOrThrow({ where: { id: draft.id } });
  check('author can edit their draft', canEditEvent(board, stored));
  check('another board member cannot see it', !canViewEvent({ id: 'someone-else', role: 'BOARD_MEMBER' }, stored));
  check('board member cannot review', !canReviewEvent(board, { ...stored, status: 'SUBMITTED' }));
  check('chair cannot approve their own event', !canApproveEvent(board, { ...stored, status: 'SUBMITTED' }));
  check('president can approve someone else’s event', canApproveEvent(president, { ...stored, status: 'SUBMITTED' }));

  console.log('\nWorkflow');
  await prisma.event.update({ where: { id: draft.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  await prisma.eventStatusHistory.create({ data: { eventId: draft.id, from: 'DRAFT', to: 'SUBMITTED', actorId: board.id } });

  await prisma.event.update({ where: { id: draft.id }, data: { status: 'CORRECTION_REQUIRED' } });
  await prisma.eventComment.create({
    data: { eventId: draft.id, authorId: secretary.id, body: 'Please correct the Rotaractor attendance count.' },
  });
  const inCorrection = await prisma.event.findUniqueOrThrow({ where: { id: draft.id } });
  check('author may edit again after a correction request', canEditEvent(board, inCorrection));

  await updateEventDraft(draft.id, { rotaractorsPresent: 16 });
  const corrected = await prisma.event.findUniqueOrThrow({ where: { id: draft.id } });
  check('totals recompute after an edit', corrected.totalParticipants === 16, corrected.totalParticipants);

  await prisma.event.update({
    where: { id: draft.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: president.id, lockedForEdits: true },
  });
  const approved = await prisma.event.findUniqueOrThrow({ where: { id: draft.id } });
  check('approval locks the report for the author', !canEditEvent(board, approved));
  check('an admin can still unlock', canEditEvent({ id: 'a', role: 'SUPER_ADMIN' }, approved));

  console.log('\nReports');
  const eventPdf = await buildEventReportPdf(draft.id);
  check('event PDF is produced', eventPdf.buffer.subarray(0, 4).toString() === '%PDF', eventPdf.buffer.subarray(0, 8).toString());
  check('event PDF has real content', eventPdf.buffer.byteLength > 20_000, `${Math.round(eventPdf.buffer.byteLength / 1024)} KB`);

  const monthly = await buildPeriodReportPdf({
    kind: 'MONTHLY',
    from: new Date(Date.UTC(2026, 0, 1)),
    to: new Date(Date.UTC(2026, 1, 1)),
    label: 'January 2026',
  });
  check('monthly report compiles approved events', monthly.count > 0, `${monthly.count} events`);
  check('monthly PDF is produced', monthly.buffer.subarray(0, 4).toString() === '%PDF');

  console.log('\nSearch, analytics and export');
  const results = await searchEvents({ q: 'Smoke Test' }, president);
  check('search finds the event by name', results.rows.some((r) => r.id === draft.id), results.total);
  const byAvenue = await searchEvents({ avenueId: communityService.id, month: '2026-01' }, president);
  check('filters by avenue and month', byAvenue.rows.length > 0, byAvenue.total);
  const scoped = await searchEvents({}, { id: 'nobody', role: 'BOARD_MEMBER' });
  check('a board member only sees their own reports', scoped.rows.length === 0);

  const stats = await adminStats('2025-26');
  check('analytics aggregate participants', stats.participants > 0, stats);
  const series = await monthlySeries('2025-26');
  check('monthly series covers 12 months', series.length === 12);
  const health = await reportingHealth();
  check('reporting health computes a percentage', health.completedPct >= 0 && health.completedPct <= 100, health.completedPct);

  const rows = await prisma.event.findMany({ where: { deletedAt: null }, include: eventInclude, take: 20 });
  const csv = buildCsv(rows as never);
  check('CSV export has a header and rows', csv.split('\n').length > 1 && csv.includes('Event ID'));
  const xlsx = await buildXlsx(rows as never);
  check('XLSX export is a valid zip container', xlsx.subarray(0, 2).toString() === 'PK', xlsx.byteLength);

  console.log('\nGoogle Drive');
  const driveReady = await isDriveReady();
  if (driveReady) {
    const result = await syncEvent(draft.id);
    check('drive sync completes', result.ok, result.message);
  } else {
    const result = await syncEvent(draft.id);
    check('unconfigured Drive degrades gracefully instead of losing data', result.status === 'PENDING', result.message);
    const stillThere = await prisma.event.findUnique({ where: { id: draft.id } });
    check('event data survives a Drive failure', Boolean(stillThere));
  }

  console.log('\nCleanup');
  const photos = await prisma.eventPhoto.findMany({ where: { eventId: draft.id } });
  const documents = await prisma.eventDocument.findMany({ where: { eventId: draft.id } });
  for (const photo of photos) {
    await removeStored(photo.storagePath);
    await removeStored(photo.thumbnailPath);
  }
  for (const doc of documents) await removeStored(doc.storagePath);
  await prisma.generatedReport.deleteMany({ where: { eventId: draft.id } });
  await prisma.event.delete({ where: { id: draft.id } });
  check('test event removed', !(await prisma.event.findUnique({ where: { id: draft.id } })));

  console.log(failures === 0 ? '\nAll smoke checks passed.\n' : `\n${failures} check(s) failed.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error('\nSmoke test crashed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
