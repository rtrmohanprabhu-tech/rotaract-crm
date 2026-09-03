'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FolderOpen, Link2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

type DriveState = {
  config: { mode: 'service_account' | 'oauth' | 'none'; rootFolderId: string | null };
  summary: { synced: number; pending: number; failed: number };
  failed?: Array<{ id: string; eventId: string; eventName: string; driveSyncStatus: string; driveSyncError: string | null }>;
  folders?: Array<{ id: string; name: string; webViewLink?: string | null }>;
};

export function DrivePanel({ initial }: { initial: DriveState }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = React.useState(initial);
  const [folderId, setFolderId] = React.useState(initial.config.rootFolderId ?? '');
  const [busy, setBusy] = React.useState<string | null>(null);

  async function refresh(withFolders = false) {
    const res = await fetch(`/api/drive${withFolders ? '?folders=1' : ''}`);
    if (res.ok) setState(await res.json());
  }

  async function post(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      toast[res.ok && data.error === undefined ? 'success' : 'error'](data.message ?? data.error ?? 'Done');
      await refresh();
      router.refresh();
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setBusy(null);
    }
  }

  const connected = state.config.mode !== 'none';

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex items-start gap-3">
          {connected ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
          )}
          <div className="flex-1">
            <p className="font-medium text-ink-800">
              {state.config.mode === 'service_account'
                ? 'Connected with a service account'
                : state.config.mode === 'oauth'
                  ? 'Connected with an admin Google account'
                  : 'Google Drive is not connected'}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {connected
                ? 'Event folders and files are filed automatically when a report is submitted.'
                : 'Reports still save normally — files sync as soon as Drive is connected.'}
            </p>
            {!connected ? (
              <a href="/api/drive/connect" className="mt-3 inline-block">
                <Button>
                  <Link2 className="h-4 w-4" /> Connect Google Drive
                </Button>
              </a>
            ) : (
              <a href="/api/drive/connect" className="mt-3 inline-block">
                <Button variant="ghost" size="sm">
                  Reconnect with a different account
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-1 text-base font-semibold text-ink-800">Root folder</h3>
        <p className="mb-4 text-sm text-ink-500">
          Everything is filed under this folder as{' '}
          <code className="rounded bg-ink-100 px-1 text-xs">Year / Avenue / Month / EVT-ID_Event</code>.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Folder ID" className="flex-1" hint="Take it from the folder URL after /folders/.">
            {(props) => <Input {...props} value={folderId} onChange={(e) => setFolderId(e.target.value)} placeholder="1AbC…" />}
          </Field>
          <Button onClick={() => post({ action: 'set_root', folderId }, 'root')} loading={busy === 'root'}>
            Save root folder
          </Button>
        </div>
        {connected ? (
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={() => refresh(true)}>
              <FolderOpen className="h-4 w-4" /> List my Drive folders
            </Button>
            {state.folders?.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {state.folders.map((folder) => (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => setFolderId(folder.id)}
                      className="w-full rounded-xl border border-ink-200 px-3 py-2 text-left text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                    >
                      {folder.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-800">Sync status</h3>
          <Button variant="secondary" size="sm" onClick={() => post({ action: 'retry_all' }, 'retry')} loading={busy === 'retry'}>
            <RefreshCw className="h-4 w-4" /> Retry pending
          </Button>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-emerald-50 p-3">
            <dt className="text-[11px] uppercase text-emerald-700">Synced</dt>
            <dd className="text-xl font-semibold text-emerald-800">{state.summary.synced}</dd>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <dt className="text-[11px] uppercase text-amber-700">Pending</dt>
            <dd className="text-xl font-semibold text-amber-800">{state.summary.pending}</dd>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <dt className="text-[11px] uppercase text-red-700">Failed</dt>
            <dd className="text-xl font-semibold text-red-800">{state.summary.failed}</dd>
          </div>
        </dl>

        {state.failed?.length ? (
          <ul className="mt-4 divide-y divide-ink-100">
            {state.failed.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{event.eventName}</p>
                  <p className="truncate text-xs text-ink-500">
                    {event.eventId} · {event.driveSyncStatus}
                    {event.driveSyncError ? ` · ${event.driveSyncError}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === event.id}
                  onClick={() => post({ action: 'retry_event', eventId: event.id }, event.id)}
                >
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-ink-500">Nothing is waiting to sync.</p>
        )}
      </div>
    </div>
  );
}
