import { z } from 'zod';
import { apiError, ok } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { driveConfig, getDrive, driveParams } from '@/server/drive/client';
import { processPendingSyncs, syncEvent } from '@/server/drive/service';
import { driveSyncSummary } from '@/server/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET → connection status + counters; ?folders=1 lists candidate root folders. */
export async function GET(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'drive.manage')) forbidden('Only an admin can manage Google Drive.');

    const config = await driveConfig();
    const summary = await driveSyncSummary();

    if (new URL(req.url).searchParams.get('folders') === '1') {
      const drive = await getDrive();
      if (!drive) return ok({ config, summary, folders: [], error: 'Drive is not connected yet.' });
      const res = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false and 'root' in parents",
        fields: 'files(id,name,webViewLink)',
        pageSize: 50,
        orderBy: 'name',
        ...driveParams(config.driveId),
      });
      return ok({ config, summary, folders: res.data.files ?? [] });
    }

    const failed = await prisma.event.findMany({
      where: { driveSyncStatus: { in: ['FAILED', 'PENDING'] }, status: { not: 'DRAFT' }, deletedAt: null },
      select: { id: true, eventId: true, eventName: true, driveSyncStatus: true, driveSyncError: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return ok({ config, summary, failed });
  } catch (error) {
    return apiError(error);
  }
}

const postSchema = z.object({
  action: z.enum(['retry_all', 'retry_event', 'set_root']),
  eventId: z.string().optional(),
  folderId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'drive.manage')) forbidden('Only an admin can manage Google Drive.');

    const body = postSchema.parse(await req.json());

    if (body.action === 'set_root') {
      if (!body.folderId) return ok({ error: 'Pick or paste a folder ID first.' }, { status: 400 });
      await prisma.clubSettings.upsert({
        where: { id: 'club' },
        create: {
          id: 'club',
          driveRootFolderId: body.folderId,
          driveRootFolderUrl: `https://drive.google.com/drive/folders/${body.folderId}`,
        },
        update: {
          driveRootFolderId: body.folderId,
          driveRootFolderUrl: `https://drive.google.com/drive/folders/${body.folderId}`,
        },
      });
      // Folder ids cached under the old root are no longer valid.
      await prisma.driveFolderCache.deleteMany({});
      return ok({ message: 'Root folder saved. New events will be filed under it.' });
    }

    if (body.action === 'retry_event') {
      if (!body.eventId) return ok({ error: 'eventId is required.' }, { status: 400 });
      const result = await syncEvent(body.eventId);
      return ok(result);
    }

    const results = await processPendingSyncs(20);
    const failures = results.filter((r) => !r.result.ok).length;
    return ok({
      message: results.length
        ? `Retried ${results.length} event(s); ${failures} still failing.`
        : 'Nothing is waiting to sync.',
      results,
    });
  } catch (error) {
    return apiError(error);
  }
}
