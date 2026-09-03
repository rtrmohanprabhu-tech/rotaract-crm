import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, ok, rateLimit } from '@/lib/api';
import { apiUser, forbidden, notFound, unauthorized } from '@/server/session';
import { canEditEvent } from '@/lib/permissions';
import { UploadError, removeStored, saveUpload, validateUpload } from '@/server/storage/local';
import { getClubSettings } from '@/server/settings';
import { refreshCompleteness } from '@/server/events';
import { logAudit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(eventId: string) {
  const user = await apiUser();
  if (!user) unauthorized();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) notFound('That event no longer exists.');
  if (!canEditEvent(user, event)) forbidden('This report is locked — you cannot change its photos.');
  return { user, event };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, event } = await guard(id);

    const limit = rateLimit(`upload:${user.id}`, 120, 60_000);
    if (!limit.ok) forbidden(`Too many uploads at once. Try again in ${limit.retryAfter}s.`);

    const settings = await getClubSettings();
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return ok({ error: 'No files received.' }, { status: 400 });

    const existing = await prisma.eventPhoto.count({ where: { eventId: id } });
    if (existing + files.length > settings.maxPhotos) {
      return ok(
        { error: `This club allows up to ${settings.maxPhotos} photos per event. You already have ${existing}.` },
        { status: 400 },
      );
    }

    const created = [];
    for (const [index, file] of files.entries()) {
      validateUpload({ name: file.name, type: file.type, size: file.size }, 'photo');
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await saveUpload({
        buffer,
        fileName: file.name,
        mimeType: file.type,
        eventId: event.eventId,
        kind: 'photo',
      });
      created.push(
        await prisma.eventPhoto.create({
          data: {
            eventId: id,
            fileName: file.name,
            mimeType: file.type,
            size: saved.size,
            width: saved.width,
            height: saved.height,
            storagePath: saved.storagePath,
            thumbnailPath: saved.thumbnailPath,
            sortOrder: existing + index,
          },
        }),
      );
    }

    const completeness = await refreshCompleteness(id);
    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'event.photos.upload',
      entityType: 'event',
      entityId: id,
      summary: `${user.name} uploaded ${created.length} photo(s) to ${event.eventId}`,
    });

    return ok({ photos: created, completeness: completeness?.score ?? event.completeness });
  } catch (error) {
    if (error instanceof UploadError) return ok({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}

const patchSchema = z.object({
  updates: z
    .array(z.object({ id: z.string(), caption: z.string().max(300).nullish(), sortOrder: z.number().int().min(0).optional() }))
    .min(1),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await guard(id);
    const body = patchSchema.parse(await req.json());
    await prisma.$transaction(
      body.updates.map((u) =>
        prisma.eventPhoto.update({
          where: { id: u.id },
          data: {
            ...(u.caption !== undefined ? { caption: u.caption ?? null } : {}),
            ...(u.sortOrder !== undefined ? { sortOrder: u.sortOrder } : {}),
          },
        }),
      ),
    );
    return ok({ updated: body.updates.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, event } = await guard(id);
    const photoId = new URL(req.url).searchParams.get('photoId');
    if (!photoId) return ok({ error: 'photoId is required' }, { status: 400 });

    const photo = await prisma.eventPhoto.findFirst({ where: { id: photoId, eventId: id } });
    if (!photo) notFound('Photo not found.');

    await prisma.eventPhoto.delete({ where: { id: photoId } });
    await removeStored(photo.storagePath);
    await removeStored(photo.thumbnailPath);
    const completeness = await refreshCompleteness(id);
    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'event.photos.delete',
      entityType: 'event',
      entityId: id,
      summary: `${user.name} removed a photo from ${event.eventId}`,
    });
    return ok({ deleted: photoId, completeness: completeness?.score ?? 0 });
  } catch (error) {
    return apiError(error);
  }
}
