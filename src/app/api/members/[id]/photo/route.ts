import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { apiError, ok } from '@/lib/api';
import { apiUser, forbidden, notFound, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { UploadError, removeStored, saveUpload, validateUpload } from '@/server/storage/local';
import { logAudit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin-only profile photo upload. Stored the same way as event evidence
 * (staged locally, served back through an authenticated route) but under a
 * `members/<id>` folder key instead of an event id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'members.manage')) forbidden('Only an admin can manage members.');

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.deletedAt) notFound('That member no longer exists.');

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return ok({ error: 'No file received.' }, { status: 400 });

    validateUpload({ name: file.name, type: file.type, size: file.size }, 'photo');
    const original = Buffer.from(await file.arrayBuffer());
    const square = await sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: 480, height: 480, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const saved = await saveUpload({
      buffer: square,
      fileName: `${id}.webp`,
      mimeType: 'image/webp',
      eventId: `members/${id}`,
      kind: 'photo',
    });

    await removeStored(target.avatarPath);
    const updated = await prisma.user.update({
      where: { id },
      data: { avatarPath: saved.storagePath, image: `/api/files/avatar/${id}?v=${Date.now()}` },
    });

    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'member.photo',
      entityType: 'user',
      entityId: id,
      summary: `${user.name} updated ${updated.name}'s profile photo`,
    });

    return ok({ image: updated.image });
  } catch (error) {
    if (error instanceof UploadError) return ok({ error: error.message }, { status: 400 });
    return apiError(error);
  }
}
