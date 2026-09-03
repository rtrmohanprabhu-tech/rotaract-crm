'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type GalleryPhoto = { id: string; caption: string | null; fileName: string };

/** Tap/click a photo for full-screen viewing; arrow keys and Esc work too. */
export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (index === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowRight') setIndex((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === 'ArrowLeft') setIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, photos.length]);

  if (photos.length === 0) {
    return <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">No photographs uploaded.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block w-full overflow-hidden rounded-xl border border-ink-200 bg-white text-left"
            >
              <span className="block aspect-[4/3] overflow-hidden bg-ink-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/files/photo/${photo.id}?variant=thumb`}
                  alt={photo.caption ?? photo.fileName}
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </span>
              {photo.caption ? <span className="block truncate px-2.5 py-2 text-xs text-ink-600">{photo.caption}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      {index !== null ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setIndex(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
            onClick={() => setIndex(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => (i === null ? i : (i + 1) % photos.length));
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/files/photo/${photos[index].id}`}
              alt={photos[index].caption ?? photos[index].fileName}
              className="max-h-[80vh] w-auto rounded-xl object-contain"
            />
            <figcaption className="mt-3 text-center text-sm text-white/80">
              {photos[index].caption ?? photos[index].fileName} · {index + 1} of {photos.length}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}
