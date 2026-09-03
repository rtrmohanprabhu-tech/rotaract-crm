'use client';

import * as React from 'react';
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export type PhotoItem = {
  id: string;
  fileName: string;
  caption: string | null;
  sortOrder: number;
  syncStatus?: string;
};

type Upload = { name: string; progress: number };

/**
 * Drag & drop / tap-to-upload with live progress (§10, §31, §58).
 * Uploads go straight to the server so a dropped connection never loses more
 * than the file that was in flight.
 */
export function PhotoUploader({
  eventId,
  photos,
  onChange,
  minPhotos,
  maxPhotos,
  disabled,
}: {
  eventId: string | null;
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  minPhotos: number;
  maxPhotos: number;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [dragging, setDragging] = React.useState(false);
  const [uploads, setUploads] = React.useState<Upload[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  const uploadFiles = React.useCallback(
    async (files: File[]) => {
      if (!eventId) {
        toast.error('Save the basics first', 'Add the event name and date, then continue — photos attach to the saved draft.');
        return;
      }
      if (files.length === 0) return;
      if (photos.length + files.length > maxPhotos) {
        toast.error('Too many photos', `This club allows up to ${maxPhotos} photos per event.`);
        return;
      }

      for (const file of files) {
        setUploads((current) => [...current, { name: file.name, progress: 0 }]);
        try {
          const result = await new Promise<{ photos: PhotoItem[]; error?: string }>((resolve, reject) => {
            const form = new FormData();
            form.append('files', file);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/events/${eventId}/photos`);
            xhr.upload.onprogress = (e) => {
              if (!e.lengthComputable) return;
              const progress = Math.round((e.loaded / e.total) * 100);
              setUploads((current) => current.map((u) => (u.name === file.name ? { ...u, progress } : u)));
            };
            xhr.onload = () => {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                reject(new Error('The server response could not be read.'));
              }
            };
            xhr.onerror = () => reject(new Error('Upload failed. Check your internet connection and try again.'));
            xhr.send(form);
          });

          if (result.error) {
            toast.error('Photo not uploaded', result.error);
          } else if (result.photos?.length) {
            onChange([...photos, ...result.photos]);
            photos = [...photos, ...result.photos];
          }
        } catch (error) {
          toast.error('Photo upload failed', error instanceof Error ? error.message : undefined);
        } finally {
          setUploads((current) => current.filter((u) => u.name !== file.name));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, maxPhotos, onChange, photos, toast],
  );

  async function remove(photoId: string) {
    const res = await fetch(`/api/events/${eventId}/photos?photoId=${photoId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Could not remove that photo', 'Please try again in a moment.');
      return;
    }
    onChange(photos.filter((p) => p.id !== photoId));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((p, i) => ({ ...p, sortOrder: i }));
    onChange(reordered);
    await fetch(`/api/events/${eventId}/photos`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: reordered.map((p) => ({ id: p.id, sortOrder: p.sortOrder })) }),
    });
  }

  const captionTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function setCaption(photoId: string, caption: string) {
    onChange(photos.map((p) => (p.id === photoId ? { ...p, caption } : p)));
    clearTimeout(captionTimers.current[photoId]);
    captionTimers.current[photoId] = setTimeout(() => {
      void fetch(`/api/events/${eventId}/photos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ id: photoId, caption }] }),
      });
    }, 700);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          'rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10',
          dragging ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-white',
          disabled && 'opacity-60',
        )}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ImagePlus className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-ink-800">Drag &amp; drop photos here</p>
        <p className="mt-1 text-xs text-ink-500">JPG, PNG or WEBP · at least {minPhotos} photos · up to {maxPhotos}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <Upload className="h-4 w-4" /> Choose photos
          </Button>
          <Button type="button" variant="ghost" onClick={() => cameraRef.current?.click()} disabled={disabled} className="sm:hidden">
            <Camera className="h-4 w-4" /> Take a photo
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            void uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {uploads.length ? (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((upload) => (
            <li key={upload.name} className="rounded-xl border border-ink-200 bg-white p-3">
              <div className="flex items-center gap-2 text-sm text-ink-700">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                <span className="min-w-0 flex-1 truncate">{upload.name}</span>
                <span className="tabular-nums text-xs text-ink-500">{upload.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${upload.progress}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length ? (
        <div>
          <p className="mb-2 text-xs font-medium text-ink-500">
            {photos.length} photo{photos.length === 1 ? '' : 's'} · the first one is used as the cover image
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <li key={photo.id} className="overflow-hidden rounded-xl border border-ink-200 bg-white">
                <div className="relative aspect-[4/3] bg-ink-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/photo/${photo.id}?variant=thumb`}
                    alt={photo.caption ?? photo.fileName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                      COVER
                    </span>
                  ) : null}
                </div>
                <div className="p-2">
                  <label className="sr-only" htmlFor={`caption-${photo.id}`}>
                    Caption for {photo.fileName}
                  </label>
                  <input
                    id={`caption-${photo.id}`}
                    value={photo.caption ?? ''}
                    onChange={(e) => setCaption(photo.id, e.target.value)}
                    placeholder="Add a caption…"
                    disabled={disabled}
                    className="w-full rounded-lg border border-transparent bg-ink-50 px-2 py-1.5 text-xs text-ink-700 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none"
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Move earlier"
                        onClick={() => move(index, -1)}
                        disabled={index === 0 || disabled}
                        className="rounded-md p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move later"
                        onClick={() => move(index, 1)}
                        disabled={index === photos.length - 1 || disabled}
                        className="rounded-md p-1 text-ink-400 hover:bg-ink-100 disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${photo.fileName}`}
                      onClick={() => remove(photo.id)}
                      disabled={disabled}
                      className="rounded-md p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
