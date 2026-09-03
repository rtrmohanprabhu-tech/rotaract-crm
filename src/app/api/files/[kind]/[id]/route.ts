import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api';
import { apiUser, forbidden, notFound, unauthorized } from '@/server/session';
import { canViewEvent } from '@/lib/permissions';
import { readStored } from '@/server/storage/local';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Serves staged evidence. Every request re-checks that the signed-in user may
 * see the parent event — files are never exposed by guessable path (§68).
 */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const { kind, id } = await params;
    const user = await apiUser();
    if (!user) unauthorized();

    const variant = new URL(req.url).searchParams.get('variant');
    let storagePath: string | null = null;
    let mimeType = 'application/octet-stream';
    let fileName = 'file';
    let eventId: string | null = null;

    if (kind === 'photo') {
      const photo = await prisma.eventPhoto.findUnique({ where: { id } });
      if (!photo) notFound('Photo not found.');
      storagePath = variant === 'thumb' && photo.thumbnailPath ? photo.thumbnailPath : photo.storagePath;
      mimeType = variant === 'thumb' && photo.thumbnailPath ? 'image/webp' : photo.mimeType;
      fileName = photo.fileName;
      eventId = photo.eventId;
    } else if (kind === 'document') {
      const doc = await prisma.eventDocument.findUnique({ where: { id } });
      if (!doc) notFound('Document not found.');
      storagePath = doc.storagePath;
      mimeType = doc.mimeType;
      fileName = doc.fileName;
      eventId = doc.eventId;
    } else if (kind === 'report') {
      const report = await prisma.generatedReport.findUnique({ where: { id } });
      if (!report) notFound('Report not found.');
      storagePath = report.storagePath;
      mimeType = 'application/pdf';
      fileName = report.fileName;
      eventId = report.eventId;
    } else {
      notFound('Unknown file type.');
    }

    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) notFound('Event not found.');
      if (!canViewEvent(user, event)) forbidden('You do not have access to this file.');
    } else if (!['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY'].includes(user.role)) {
      forbidden('Club-level reports are available to the review team.');
    }

    const buffer = await readStored(storagePath!);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `${mimeType === 'application/pdf' || mimeType.startsWith('image/') ? 'inline' : 'attachment'}; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
