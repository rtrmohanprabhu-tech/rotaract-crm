import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HardDrive } from 'lucide-react';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { getAvenues, getClubSettings, getReportSections } from '@/server/settings';
import { aiEnabled } from '@/server/ai';
import { SettingsForm } from '@/features/settings/settings-form';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, 'settings.manage')) redirect('/dashboard');

  const [settings, sections, avenues] = await Promise.all([getClubSettings(), getReportSections(), getAvenues()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Club settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Everything here is editable — nothing about your club is hard-coded into the application.
        </p>
      </header>

      <Link href="/settings/drive" className="card flex items-center gap-4 p-4 transition hover:shadow-pop">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-azure-50 text-azure-600">
          <HardDrive className="h-5 w-5" />
        </span>
        <span className="flex-1">
          <span className="block text-sm font-semibold text-ink-800">Google Drive</span>
          <span className="block text-xs text-ink-500">
            {settings.driveRootFolderId ? 'Connected — manage the root folder and sync status' : 'Not connected yet'}
          </span>
        </span>
        <span className="text-sm text-brand-600">Open →</span>
      </Link>

      <SettingsForm
        aiConfigured={aiEnabled()}
        initial={{
          clubName: settings.clubName,
          rotarySponsor: settings.rotarySponsor,
          clubId: settings.clubId,
          groupName: settings.groupName,
          riDistrict: settings.riDistrict,
          presidentName: settings.presidentName,
          secretaryName: settings.secretaryName,
          currentYear: settings.currentYear,
          currency: settings.currency,
          minPhotos: settings.minPhotos,
          maxPhotos: settings.maxPhotos,
          reportingDeadlineHrs: settings.reportingDeadlineHrs,
          requiredFields: settings.requiredFields,
          aiEnabled: settings.aiEnabled,
          reportSections: sections,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Avenues of service</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="flex flex-wrap gap-2">
            {avenues.map((avenue) => (
              <li
                key={avenue.id}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1.5 text-sm text-ink-700"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: avenue.color }} />
                {avenue.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-500">
            Avenues drive the Drive folder tree and every avenue report. Add or rename them with the API
            (<code className="rounded bg-ink-100 px-1">upsertAvenueAction</code>) or directly in the database — renaming an
            avenue does not move existing Drive folders.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
