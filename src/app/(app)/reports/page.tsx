import { redirect } from 'next/navigation';
import { Download, ExternalLink } from 'lucide-react';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getAvenues, getClubSettings } from '@/server/settings';
import { aiEnabled } from '@/server/ai';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportGenerator } from '@/features/reports/report-generator';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const user = await requireUser();
  if (!can(user, 'report.generate')) redirect('/dashboard');

  const [settings, avenues, reports] = await Promise.all([
    getClubSettings(),
    getAvenues(),
    prisma.generatedReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { event: { select: { id: true, eventId: true, eventName: true } }, generatedBy: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Reports</h1>
        <p className="mt-1 text-sm text-ink-500">
          Monthly, avenue and annual reports are compiled from the data board members already entered — nobody formats
          anything by hand.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
        </CardHeader>
        <CardBody>
          <ReportGenerator
            avenues={avenues.map((a) => ({ id: a.id, name: a.name }))}
            currentYear={settings.currentYear}
            aiAvailable={aiEnabled() && settings.aiEnabled}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently generated</CardTitle>
        </CardHeader>
        <CardBody>
          {reports.length === 0 ? (
            <p className="text-sm text-ink-500">No reports generated yet.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{report.title}</p>
                    <p className="text-xs text-ink-500">
                      {report.kind} · {formatDateTime(report.createdAt)}
                      {report.generatedBy ? ` · ${report.generatedBy.name}` : ''}
                      {report.syncStatus === 'SYNCED' ? ' · on Drive' : ''}
                    </p>
                  </div>
                  <a
                    href={`/api/files/report/${report.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </a>
                  {report.driveFileUrl ? (
                    <a
                      href={report.driveFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-azure-600 hover:underline"
                    >
                      Drive <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
