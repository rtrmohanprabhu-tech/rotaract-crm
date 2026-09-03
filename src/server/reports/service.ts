import { prisma } from '@/lib/prisma';
import { saveGenerated } from '@/server/storage/local';
import { periodReportFileName, reportFileName } from '@/lib/naming';
import { getClubSettings } from '@/server/settings';
import { syncEvent, uploadReportToDrive } from '@/server/drive/service';
import { buildEventReportPdf, buildPeriodReportPdf } from './pdf';
import { logAudit } from '@/server/audit';

export async function generateEventReport(eventId: string, actor: { id: string; name: string }) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const { buffer } = await buildEventReportPdf(eventId);
  const fileName = reportFileName(event.eventId, event.eventName);
  const saved = await saveGenerated(buffer, event.eventId, fileName);

  // One current report per event: older ones are superseded.
  await prisma.generatedReport.deleteMany({ where: { eventId, kind: 'EVENT' } });
  const report = await prisma.generatedReport.create({
    data: {
      kind: 'EVENT',
      title: `${event.eventId} — ${event.eventName}`,
      fileName,
      storagePath: saved.storagePath,
      eventId,
      generatedById: actor.id,
    },
  });

  await logAudit({
    actorId: actor.id,
    actorLabel: actor.name,
    action: 'report.generate',
    entityType: 'event',
    entityId: eventId,
    summary: `${actor.name} generated the report PDF for ${event.eventId}`,
  });

  // Push into 06_Generated_Report (best effort — never blocks the download).
  const drive = await syncEvent(eventId).catch((error) => ({
    ok: false,
    status: 'FAILED' as const,
    message: error instanceof Error ? error.message : 'Drive sync failed',
  }));

  return { report, drive, buffer, fileName };
}

export type PeriodReportRequest = {
  kind: 'MONTHLY' | 'AVENUE' | 'ANNUAL';
  month?: string; // "2026-01"
  yearLabel?: string; // "2026-27"
  avenueId?: string | null;
  includePhotos?: boolean;
};

export async function generatePeriodReport(request: PeriodReportRequest, actor: { id: string; name: string }) {
  const settings = await getClubSettings();
  const avenue = request.avenueId ? await prisma.avenue.findUnique({ where: { id: request.avenueId } }) : null;

  let from: Date;
  let to: Date;
  let label: string;
  let periodKey: string;

  if (request.kind === 'MONTHLY') {
    const key = request.month ?? new Date().toISOString().slice(0, 7);
    const [y, m] = key.split('-').map(Number);
    from = new Date(Date.UTC(y, m - 1, 1));
    to = new Date(Date.UTC(y, m, 1));
    label = `${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(from)}${avenue ? ` — ${avenue.name}` : ''}`;
    periodKey = key;
  } else {
    const yearLabel = request.yearLabel ?? settings.currentYear;
    const start = Number(yearLabel.split('-')[0]);
    from = new Date(Date.UTC(start, 6, 1));
    to = new Date(Date.UTC(start + 1, 6, 1));
    label = request.kind === 'AVENUE' && avenue ? `${avenue.name} — ${yearLabel}` : `Rotaract Year ${yearLabel}`;
    periodKey = yearLabel;
  }

  const { buffer, count } = await buildPeriodReportPdf({
    kind: request.kind,
    from,
    to,
    avenueId: request.avenueId ?? null,
    label,
    includePhotos: request.includePhotos,
  });

  const fileName = periodReportFileName(request.kind, label);
  const saved = await saveGenerated(buffer, '_club', fileName);
  const report = await prisma.generatedReport.create({
    data: {
      kind: request.kind,
      title: label,
      fileName,
      storagePath: saved.storagePath,
      periodKey,
      filters: { avenueId: request.avenueId ?? null, includePhotos: request.includePhotos ?? true } as never,
      generatedById: actor.id,
    },
  });

  await logAudit({
    actorId: actor.id,
    actorLabel: actor.name,
    action: 'report.generate.period',
    entityType: 'report',
    entityId: report.id,
    summary: `${actor.name} generated the ${request.kind.toLowerCase()} report "${label}" (${count} events)`,
  });

  const drive = await uploadReportToDrive(report.id).catch(() => ({
    ok: false,
    status: 'FAILED' as const,
    message: 'Drive upload failed',
  }));

  return { report, buffer, fileName, count, drive };
}
