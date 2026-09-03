import { prisma } from '@/lib/prisma';
import { apiError, ok } from '@/lib/api';
import { apiUser, forbidden, notFound, unauthorized } from '@/server/session';
import { canEditEvent } from '@/lib/permissions';
import { UploadError, removeStored, saveUpload, validateUpload } from '@/server/storage/local';
import { refreshCompleteness } from '@/server/events';
import { documentCategoryEnum } from '@/lib/validation';
import { logAudit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(eventId: string) {
  const user = await apiUser();
  if (!user) unauthorized();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.deletedAt) notFound('That event no longer exists.');
  if (!canEditEvent(user, event)) forbidden('This report is locked — you cannot change its documents.');
  return { user, event };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, event } = await guard(id);

    const form = await req.formData();
    const category = documentCategoryEnum.catch('OTHER').parse(form.get('category'));
    const label = (form.get('label') as string | null)?.slice(0, 200) ?? null;
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) return ok({ error: 'No files received.' }, { status: 400 });

    const created = [];
    for (const file of files) {
      validateUpload({ name: file.name, type: file.type, size: file.size }, 'document');
      const buffer = Buffer.from(await file.arrayBuffer());
      const saved = await saveUpload({
        buffer,
        fileName: file.name,
        mimeType: file.type,
        eventId: event.eventId,
        kind: 'document',
      });
      created.push(
        await prisma.eventDocument.create({
          data: {
            eventId: id,
            category,
            label,
            fileName: file.name,
            mimeType: file.type,
            size: saved.size,
            storagePath: saved.storagePath,
          },
        }),
      );
    }

    const completeness = await refreshCompleteness(id);
    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'event.documents.upload',
      entityType: 'event',
      entityId: id,
      summary: `${user.name} uploaded ${created.length} ${category.toLowerCase().replace(/_/g, ' ')} file(s) to ${event.eventId}`,
    });
    return ok({ documents: created, completeness: completeness?.score ?? event.completeness });
  } catch (error) {
    if (error instanceof UploadError) return ok({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await guard(id);
    const documentId = new URL(req.url).searchParams.get('documentId');
    if (!documentId) return ok({ error: 'documentId is required' }, { status: 400 });

    const doc = await prisma.eventDocument.findFirst({ where: { id: documentId, eventId: id } });
    if (!doc) notFound('Document not found.');

    await prisma.eventDocument.delete({ where: { id: documentId } });
    await removeStored(doc.storagePath);
    const completeness = await refreshCompleteness(id);
    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'event.documents.delete',
      entityType: 'event',
      entityId: id,
      summary: `${user.name} removed ${doc.fileName}`,
    });
    return ok({ deleted: documentId, completeness: completeness?.score ?? 0 });
  } catch (error) {
    return apiError(error);
  }
}
