'use client';

import * as React from 'react';
import { FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { DOCUMENT_LABELS } from '@/lib/constants';
import type { DocumentCategory } from '@/generated/prisma/enums';

export type DocumentItem = {
  id: string;
  category: DocumentCategory;
  fileName: string;
  size: number;
  label: string | null;
};

const CATEGORY_ORDER: DocumentCategory[] = [
  'POSTER',
  'ATTENDANCE_SHEET',
  'BILL',
  'INVOICE',
  'PERMISSION_LETTER',
  'APPRECIATION_LETTER',
  'CERTIFICATE',
  'NEWSPAPER_COVERAGE',
  'SOCIAL_MEDIA_SCREENSHOT',
  'OTHER',
];

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentUploader({
  eventId,
  documents,
  onChange,
  disabled,
}: {
  eventId: string | null;
  documents: DocumentItem[];
  onChange: (documents: DocumentItem[]) => void;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [category, setCategory] = React.useState<DocumentCategory>('POSTER');
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    if (!eventId) {
      toast.error('Save the basics first', 'Documents attach to a saved draft.');
      return;
    }
    if (!files.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('category', category);
      files.forEach((file) => form.append('files', file));
      const res = await fetch(`/api/events/${eventId}/documents`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Upload failed', data.error ?? 'Please try again.');
        return;
      }
      onChange([...documents, ...data.documents]);
    } catch {
      toast.error('Upload failed', 'Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/events/${eventId}/documents?documentId=${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Could not remove that file');
      return;
    }
    onChange(documents.filter((d) => d.id !== id));
  }

  const grouped = CATEGORY_ORDER.map((cat) => ({ cat, items: documents.filter((d) => d.category === cat) })).filter(
    (g) => g.items.length,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-200 bg-white p-4">
        <label className="field-label" htmlFor="doc-category">
          What are you attaching?
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            id="doc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="input-base sm:max-w-xs"
            disabled={disabled}
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {DOCUMENT_LABELS[cat]}
              </option>
            ))}
          </select>
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={disabled || busy} loading={busy}>
            <Paperclip className="h-4 w-4" /> Choose file(s)
          </Button>
        </div>
        <p className="hint">PDF, DOCX, XLSX, JPG or PNG. Bills and invoices are filed into 04_Financials on Drive automatically.</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.xlsx,image/jpeg,image/png,image/webp"
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
        </p>
      ) : null}

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          No documents attached yet. A poster and an attendance sheet make the report much stronger.
        </p>
      ) : (
        grouped.map((group) => (
          <div key={group.cat}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{DOCUMENT_LABELS[group.cat]}</p>
            <ul className="space-y-2">
              {group.items.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3">
                  <FileText className="h-5 w-5 shrink-0 text-ink-400" />
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/api/files/document/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm font-medium text-ink-800 hover:text-brand-600"
                    >
                      {doc.fileName}
                    </a>
                    <p className="text-xs text-ink-500">{humanSize(doc.size)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${doc.fileName}`}
                    onClick={() => remove(doc.id)}
                    disabled={disabled}
                    className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
