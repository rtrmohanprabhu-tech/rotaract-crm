import { redirect } from 'next/navigation';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { driveConfig } from '@/server/drive/client';
import { driveSyncSummary } from '@/server/analytics';
import { DrivePanel } from '@/features/settings/drive-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google Drive' };

const CALLBACK_MESSAGES: Record<string, string> = {
  cancelled: 'Authorisation was cancelled.',
  state_mismatch: 'The authorisation link expired. Please start again.',
  not_configured: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing on the server.',
  no_refresh_token: 'Google did not return a refresh token. Remove the app from your Google account permissions and try again.',
};

export default async function DriveSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await requireUser();
  if (!can(user, 'drive.manage')) redirect('/dashboard');

  const { connected, error } = await searchParams;
  const [config, summary, failed] = await Promise.all([
    driveConfig(),
    driveSyncSummary(),
    prisma.event.findMany({
      where: { driveSyncStatus: { in: ['FAILED', 'PENDING'] }, status: { not: 'DRAFT' }, deletedAt: null },
      select: { id: true, eventId: true, eventName: true, driveSyncStatus: true, driveSyncError: true },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Google Drive</h1>
        <p className="mt-1 text-sm text-ink-500">
          Photos, posters, bills and generated reports live in Drive; the database keeps the folder and file IDs.
        </p>
      </header>

      {connected ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Google Drive connected. Pick the root folder below if you have not already.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {CALLBACK_MESSAGES[error] ?? 'Authorisation failed. Please try again.'}
        </p>
      ) : null}

      <DrivePanel
        initial={{
          config: { mode: config.mode, rootFolderId: config.rootFolderId ?? null },
          summary,
          failed: failed.map((f) => ({ ...f, driveSyncStatus: f.driveSyncStatus as string })),
        }}
      />
    </div>
  );
}
