import { apiError } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { searchEvents } from '@/server/search';
import { eventSearchSchema } from '@/lib/validation';
import { buildCsv, buildXlsx } from '@/server/export';
import { logAudit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** CSV / Excel export honouring the current filters (§35). */
export async function GET(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'export.data')) forbidden('Your role cannot export data.');

    const url = new URL(req.url);
    const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const query = eventSearchSchema.parse(Object.fromEntries(url.searchParams.entries()));
    const { rows, total } = await searchEvents({ ...query, page: 1, perPage: 5000 }, user);

    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `rotaract-events-${stamp}.${format}`;

    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'export.events',
      entityType: 'export',
      entityId: stamp,
      summary: `${user.name} exported ${total} event(s) as ${format.toUpperCase()}`,
      metadata: { filters: Object.fromEntries(url.searchParams.entries()) },
    });

    if (format === 'csv') {
      return new Response(buildCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      });
    }

    const buffer = await buildXlsx(rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
