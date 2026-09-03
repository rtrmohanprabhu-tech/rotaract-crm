import { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { readStored } from '@/server/storage/local';
import { DOCUMENT_DRIVE_BUCKET } from '@/lib/constants';
import {
  EVENT_SUBFOLDERS,
  documentFileName,
  eventDrivePath,
  photoFileName,
  reportFileName,
  type EventSubfolderKey,
} from '@/lib/naming';
import { getDrive, driveConfig, driveParams, DriveNotConfiguredError } from './client';

/**
 * All Drive writes go through here (§13–§15, §36).
 *
 * Guarantees:
 *  - The database is the source of truth; Drive failures never lose event data.
 *  - Folder creation is idempotent (cached by path, plus a name lookup).
 *  - Every failure is recorded on the event and retryable from the admin UI.
 */

export type SyncResult = {
  ok: boolean;
  status: 'SYNCED' | 'PENDING' | 'FAILED' | 'NOT_REQUIRED';
  message: string;
  folderUrl?: string | null;
  uploaded?: number;
};

function folderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
  driveId?: string | null,
): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name = '${escaped}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    ...driveParams(driveId),
  });
  const found = res.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error(`Drive did not return an id for folder "${name}"`);
  return created.data.id;
}

/** Walks/creates a path below the club root, caching each level. */
export async function ensureFolderPath(segments: string[]): Promise<{ id: string; path: string }> {
  const drive = await getDrive();
  const config = await driveConfig();
  if (!drive || !config.rootFolderId) throw new DriveNotConfiguredError();

  let parentId = config.rootFolderId;
  let walked = '';
  for (const segment of segments) {
    walked = walked ? `${walked}/${segment}` : segment;
    const cached = await prisma.driveFolderCache.findUnique({ where: { path: walked } });
    if (cached) {
      parentId = cached.folderId;
      continue;
    }
    const id = await findOrCreateFolder(drive, segment, parentId, config.driveId);
    await prisma.driveFolderCache.upsert({
      where: { path: walked },
      create: { path: walked, folderId: id },
      update: { folderId: id },
    });
    parentId = id;
  }
  return { id: parentId, path: walked };
}

/** Creates (once) the event folder and its six numbered subfolders. */
export async function ensureEventFolder(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { avenue: true, driveFolder: true },
  });
  if (!event) throw new Error('Event not found');
  if (event.driveFolder) return event.driveFolder;

  const settings = await prisma.clubSettings.findUnique({ where: { id: 'club' } });
  const segments = eventDrivePath({
    eventDate: event.eventDate,
    avenueName: event.avenue.name,
    eventId: event.eventId,
    eventName: event.eventName,
    yearLabel: settings?.currentYear,
  });

  const { id: eventFolderId, path } = await ensureFolderPath(segments);
  const drive = await getDrive();
  const config = await driveConfig();
  if (!drive) throw new DriveNotConfiguredError();

  const subIds: Partial<Record<EventSubfolderKey, string>> = {};
  for (const sub of EVENT_SUBFOLDERS) {
    subIds[sub.key] = await findOrCreateFolder(drive, sub.name, eventFolderId, config.driveId);
  }

  return prisma.driveFolder.create({
    data: {
      eventId: event.id,
      folderId: eventFolderId,
      folderUrl: folderUrl(eventFolderId),
      path,
      photosFolderId: subIds.photos,
      posterFolderId: subIds.poster,
      documentsFolderId: subIds.documents,
      financialsFolderId: subIds.financials,
      socialFolderId: subIds.social,
      reportFolderId: subIds.report,
    },
  });
}

async function uploadBuffer(params: {
  drive: drive_v3.Drive;
  buffer: Buffer;
  name: string;
  mimeType: string;
  parentId: string;
}) {
  const res = await params.drive.files.create({
    requestBody: { name: params.name, parents: [params.parentId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id,name,size,mimeType,webViewLink',
    supportsAllDrives: true,
  });
  return res.data;
}

/**
 * Uploads everything for an event that has not reached Drive yet, then flips
 * the event's sync status. Safe to call repeatedly (it skips synced files).
 */
export async function syncEvent(eventId: string): Promise<SyncResult> {
  const ready = await (async () => {
    const config = await driveConfig();
    return config.mode !== 'none' && Boolean(config.rootFolderId);
  })();

  if (!ready) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        driveSyncStatus: 'PENDING',
        driveSyncError: 'Google Drive is not connected. An admin can connect it in Settings → Google Drive.',
      },
    });
    return {
      ok: false,
      status: 'PENDING',
      message: 'Event saved. Google Drive synchronisation pending — Drive is not connected yet.',
    };
  }

  await prisma.event.update({ where: { id: eventId }, data: { driveSyncStatus: 'SYNCING', driveSyncError: null } });

  try {
    const drive = await getDrive();
    if (!drive) throw new DriveNotConfiguredError();

    const folder = await ensureEventFolder(eventId);
    const event = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        documents: true,
        reports: true,
      },
    });

    let uploaded = 0;

    for (const [index, photo] of event.photos.entries()) {
      if (photo.driveFileId) continue;
      const buffer = await readStored(photo.storagePath);
      const name = photoFileName(event.eventId, event.eventName, index + 1, photo.fileName);
      const file = await uploadBuffer({
        drive,
        buffer,
        name,
        mimeType: photo.mimeType,
        parentId: folder.photosFolderId ?? folder.folderId,
      });
      await prisma.eventPhoto.update({
        where: { id: photo.id },
        data: { driveFileId: file.id, driveFileUrl: file.webViewLink, syncStatus: 'SYNCED' },
      });
      await prisma.driveFile.create({
        data: {
          eventId: event.id,
          folderId: folder.id,
          driveFileId: file.id!,
          name,
          mimeType: photo.mimeType,
          size: photo.size,
          webViewLink: file.webViewLink,
          sourceType: 'photo',
          sourceId: photo.id,
        },
      });
      uploaded += 1;
    }

    const perCategory = new Map<string, number>();
    for (const doc of event.documents) {
      const seq = (perCategory.get(doc.category) ?? 0) + 1;
      perCategory.set(doc.category, seq);
      if (doc.driveFileId) continue;
      const bucket = DOCUMENT_DRIVE_BUCKET[doc.category];
      const parentId =
        (bucket === 'poster' && folder.posterFolderId) ||
        (bucket === 'financials' && folder.financialsFolderId) ||
        (bucket === 'social' && folder.socialFolderId) ||
        (bucket === 'report' && folder.reportFolderId) ||
        folder.documentsFolderId ||
        folder.folderId;
      const buffer = await readStored(doc.storagePath);
      const name = documentFileName(event.eventId, event.eventName, doc.category, seq, doc.fileName);
      const file = await uploadBuffer({ drive, buffer, name, mimeType: doc.mimeType, parentId });
      await prisma.eventDocument.update({
        where: { id: doc.id },
        data: { driveFileId: file.id, driveFileUrl: file.webViewLink, syncStatus: 'SYNCED' },
      });
      await prisma.driveFile.create({
        data: {
          eventId: event.id,
          folderId: folder.id,
          driveFileId: file.id!,
          name,
          mimeType: doc.mimeType,
          size: doc.size,
          webViewLink: file.webViewLink,
          sourceType: 'document',
          sourceId: doc.id,
        },
      });
      uploaded += 1;
    }

    for (const report of event.reports) {
      if (report.driveFileId) continue;
      const buffer = await readStored(report.storagePath);
      const name = reportFileName(event.eventId, event.eventName);
      const file = await uploadBuffer({
        drive,
        buffer,
        name,
        mimeType: 'application/pdf',
        parentId: folder.reportFolderId ?? folder.folderId,
      });
      await prisma.generatedReport.update({
        where: { id: report.id },
        data: { driveFileId: file.id, driveFileUrl: file.webViewLink, syncStatus: 'SYNCED' },
      });
      await prisma.driveFile.create({
        data: {
          eventId: event.id,
          folderId: folder.id,
          driveFileId: file.id!,
          name,
          mimeType: 'application/pdf',
          webViewLink: file.webViewLink,
          sourceType: 'report',
          sourceId: report.id,
        },
      });
      uploaded += 1;
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { driveSyncStatus: 'SYNCED', driveSyncedAt: new Date(), driveSyncError: null },
    });
    await prisma.syncJob.updateMany({
      where: { eventId, completedAt: null },
      data: { completedAt: new Date() },
    });

    return {
      ok: true,
      status: 'SYNCED',
      message: uploaded ? `Synced ${uploaded} file${uploaded === 1 ? '' : 's'} to Google Drive.` : 'Google Drive is up to date.',
      folderUrl: folder.folderUrl,
      uploaded,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Drive error';
    console.error('[drive] sync failed for', eventId, error);
    await prisma.event.update({
      where: { id: eventId },
      data: { driveSyncStatus: 'FAILED', driveSyncError: message.slice(0, 500) },
    });
    await queueSync(eventId, 'event_folder', message);
    return { ok: false, status: 'FAILED', message: `Google Drive sync failed: ${message}` };
  }
}

/** Fire-and-forget: never let a Drive problem block the user's request. */
export function syncEventInBackground(eventId: string) {
  void syncEvent(eventId).catch((error) => console.error('[drive] background sync error', error));
}

export async function queueSync(eventId: string, kind: string, lastError?: string) {
  const existing = await prisma.syncJob.findFirst({ where: { eventId, kind, completedAt: null } });
  const backoffMinutes = Math.min(60, 2 ** ((existing?.attempts ?? 0) + 1));
  const nextRunAt = new Date(Date.now() + backoffMinutes * 60_000);
  if (existing) {
    await prisma.syncJob.update({
      where: { id: existing.id },
      data: { attempts: existing.attempts + 1, lastError: lastError?.slice(0, 500), nextRunAt },
    });
  } else {
    await prisma.syncJob.create({ data: { eventId, kind, attempts: 1, lastError: lastError?.slice(0, 500), nextRunAt } });
  }
}

/** Called by /api/drive/retry (manual) or a cron ping. */
export async function processPendingSyncs(limit = 10) {
  const jobs = await prisma.syncJob.findMany({
    where: { completedAt: null, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: 'asc' },
    take: limit,
  });
  const results: Array<{ eventId: string; result: SyncResult }> = [];
  for (const job of jobs) {
    results.push({ eventId: job.eventId, result: await syncEvent(job.eventId) });
  }
  return results;
}

export async function uploadReportToDrive(reportId: string): Promise<SyncResult> {
  const report = await prisma.generatedReport.findUnique({ where: { id: reportId } });
  if (!report) return { ok: false, status: 'FAILED', message: 'Report not found' };
  if (report.eventId) return syncEvent(report.eventId);

  // Period reports live under <year>/_Reports
  try {
    const drive = await getDrive();
    if (!drive) throw new DriveNotConfiguredError();
    const settings = await prisma.clubSettings.findUnique({ where: { id: 'club' } });
    const { id: parentId } = await ensureFolderPath([settings?.currentYear ?? 'Reports', '_Club_Reports']);
    const buffer = await readStored(report.storagePath);
    const file = await uploadBuffer({
      drive,
      buffer,
      name: report.fileName,
      mimeType: 'application/pdf',
      parentId,
    });
    await prisma.generatedReport.update({
      where: { id: report.id },
      data: { driveFileId: file.id, driveFileUrl: file.webViewLink, syncStatus: 'SYNCED' },
    });
    return { ok: true, status: 'SYNCED', message: 'Report uploaded to Google Drive.', folderUrl: file.webViewLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Drive error';
    await prisma.generatedReport.update({ where: { id: report.id }, data: { syncStatus: 'FAILED' } });
    return { ok: false, status: 'FAILED', message };
  }
}
