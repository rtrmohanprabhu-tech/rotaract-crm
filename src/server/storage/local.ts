import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ALLOWED_DOC_TYPES, ALLOWED_IMAGE_TYPES } from '@/lib/constants';

/**
 * Evidence staging area.
 *
 * Files land here first so an upload never fails because Google Drive is down
 * (§36). The Drive sync job reads from here afterwards. Swap this module for an
 * S3/R2 implementation without touching callers — the public API is
 * saveUpload / readStored / removeStored.
 */
const ROOT = path.resolve(process.env.UPLOAD_DIR ?? './.uploads');

export const maxUploadBytes = () => Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;

export type SavedFile = {
  storagePath: string;
  size: number;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
  thumbnailPath?: string;
  checksum: string;
};

export class UploadError extends Error {}

function assertInsideRoot(absolute: string) {
  const rel = path.relative(ROOT, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new UploadError('Refusing to touch a file outside the upload directory.');
  }
}

export function validateUpload(file: { name: string; type: string; size: number }, kind: 'photo' | 'document') {
  const allowed = kind === 'photo' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOC_TYPES;
  if (!allowed.includes(file.type)) {
    throw new UploadError(
      kind === 'photo'
        ? `"${file.name}" is not a supported image. Use JPG, PNG or WEBP.`
        : `"${file.name}" is not a supported document. Use PDF, DOCX, XLSX or an image.`,
    );
  }
  if (file.size > maxUploadBytes()) {
    throw new UploadError(
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${process.env.MAX_UPLOAD_MB ?? 25} MB.`,
    );
  }
  if (file.size === 0) throw new UploadError(`"${file.name}" is empty.`);
}

/**
 * Photos: originals are preserved (§32) — we only generate an extra web-sized
 * copy for thumbnails so the wizard stays fast on a phone connection.
 */
export async function saveUpload(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  eventId: string;
  kind: 'photo' | 'document' | 'report';
}): Promise<SavedFile> {
  const dir = path.join(ROOT, params.eventId, params.kind === 'photo' ? 'photos' : params.kind === 'report' ? 'reports' : 'documents');
  await mkdir(dir, { recursive: true });

  const ext = path.extname(params.fileName) || '';
  const base = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const absolute = path.join(dir, `${base}${ext}`);
  assertInsideRoot(absolute);
  await writeFile(absolute, params.buffer);

  const result: SavedFile = {
    storagePath: path.relative(ROOT, absolute),
    size: params.buffer.byteLength,
    mimeType: params.mimeType,
    fileName: params.fileName,
    checksum: createHash('sha256').update(params.buffer).digest('hex').slice(0, 32),
  };

  if (params.kind === 'photo') {
    try {
      const image = sharp(params.buffer, { failOn: 'none' });
      const meta = await image.metadata();
      result.width = meta.width;
      result.height = meta.height;
      const thumbAbsolute = path.join(dir, `${base}_thumb.webp`);
      await image.rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 78 }).toFile(thumbAbsolute);
      result.thumbnailPath = path.relative(ROOT, thumbAbsolute);
    } catch (error) {
      // A thumbnail is a nicety; the original is what matters.
      console.warn('[storage] thumbnail generation failed', error);
    }
  }

  return result;
}

export async function readStored(storagePath: string): Promise<Buffer> {
  const absolute = path.join(ROOT, storagePath);
  assertInsideRoot(absolute);
  return readFile(absolute);
}

export async function storedSize(storagePath: string): Promise<number> {
  const absolute = path.join(ROOT, storagePath);
  assertInsideRoot(absolute);
  const s = await stat(absolute);
  return s.size;
}

export async function removeStored(storagePath?: string | null) {
  if (!storagePath) return;
  try {
    const absolute = path.join(ROOT, storagePath);
    assertInsideRoot(absolute);
    await unlink(absolute);
  } catch {
    /* already gone */
  }
}

export async function saveGenerated(buffer: Buffer, eventId: string, fileName: string) {
  return saveUpload({ buffer, fileName, mimeType: 'application/pdf', eventId, kind: 'report' });
}

export function uploadRoot() {
  return ROOT;
}
