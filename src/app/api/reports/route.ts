import { z } from 'zod';
import { apiError, ok } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { generateEventReport, generatePeriodReport } from '@/server/reports/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('EVENT'), eventId: z.string() }),
  z.object({ kind: z.literal('MONTHLY'), month: z.string(), avenueId: z.string().nullish(), includePhotos: z.boolean().optional() }),
  z.object({ kind: z.literal('AVENUE'), yearLabel: z.string(), avenueId: z.string(), includePhotos: z.boolean().optional() }),
  z.object({ kind: z.literal('ANNUAL'), yearLabel: z.string(), includePhotos: z.boolean().optional() }),
]);

export async function POST(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'report.generate')) forbidden('Your role cannot generate reports.');

    const body = schema.parse(await req.json());

    if (body.kind === 'EVENT') {
      const event = await prisma.event.findUnique({ where: { id: body.eventId } });
      if (!event || event.deletedAt) return ok({ error: 'Event not found.' }, { status: 404 });
      if (event.status !== 'APPROVED' && user.role !== 'SUPER_ADMIN') {
        return ok({ error: 'Reports are generated from approved events. Approve it first.' }, { status: 400 });
      }
      const { report, drive } = await generateEventReport(body.eventId, user);
      return ok({
        report: { id: report.id, fileName: report.fileName, downloadUrl: `/api/files/report/${report.id}` },
        drive,
      });
    }

    const { report, count, drive } = await generatePeriodReport(
      {
        kind: body.kind,
        month: 'month' in body ? body.month : undefined,
        yearLabel: 'yearLabel' in body ? body.yearLabel : undefined,
        avenueId: 'avenueId' in body ? (body.avenueId ?? null) : null,
        includePhotos: body.includePhotos,
      },
      user,
    );

    return ok({
      report: { id: report.id, fileName: report.fileName, downloadUrl: `/api/files/report/${report.id}`, title: report.title },
      eventCount: count,
      drive,
    });
  } catch (error) {
    return apiError(error);
  }
}
