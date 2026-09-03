import { redirect } from 'next/navigation';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { adminStats, avenueBreakdown, monthlySeries, topChairs, topPartners } from '@/server/analytics';
import { getClubSettings } from '@/server/settings';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, StatCard } from '@/components/ui/misc';
import {
  AvenueBarChart,
  AvenueDonut,
  EventsByMonthChart,
  ExpenditureChart,
  PeopleByMonthChart,
} from '@/components/charts/charts';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireUser();
  if (!can(user, 'analytics.view')) redirect('/dashboard');

  const settings = await getClubSettings();
  const { year } = await searchParams;
  const yearLabel = year ?? settings.currentYear;

  const [stats, series, avenues, chairs, partners] = await Promise.all([
    adminStats(yearLabel),
    monthlySeries(yearLabel),
    avenueBreakdown(yearLabel),
    topChairs(6),
    topPartners(6),
  ]);

  const mostActive = [...avenues].sort((a, b) => b.events - a.events)[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Analytics</h1>
          <p className="mt-1 text-sm text-ink-500">Rotaract year {yearLabel} · every figure comes from structured fields.</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Events" value={formatNumber(stats.totalEvents)} />
        <StatCard label="Participants" value={formatNumber(stats.participants)} />
        <StatCard label="Beneficiaries" value={formatNumber(stats.beneficiaries)} />
        <StatCard label="Expenditure" value={formatCurrency(stats.expenditure)} />
        <StatCard label="Most active avenue" value={mostActive?.events ? mostActive.name : '—'} sub={mostActive?.events ? `${mostActive.events} events` : undefined} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events by month</CardTitle>
          </CardHeader>
          <CardBody>
            <EventsByMonthChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participants &amp; beneficiaries by month</CardTitle>
          </CardHeader>
          <CardBody>
            <PeopleByMonthChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenditure by month</CardTitle>
          </CardHeader>
          <CardBody>
            <ExpenditureChart data={series} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events by avenue of service</CardTitle>
          </CardHeader>
          <CardBody>
            <AvenueDonut data={avenues} />
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Avenue breakdown</CardTitle>
          </CardHeader>
          <CardBody>
            <AvenueBarChart data={avenues} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs uppercase text-ink-500">
                    <th className="py-2 pr-3 font-medium">Avenue</th>
                    <th className="px-3 py-2 text-right font-medium">Events</th>
                    <th className="px-3 py-2 text-right font-medium">Participants</th>
                    <th className="px-3 py-2 text-right font-medium">Beneficiaries</th>
                    <th className="py-2 pl-3 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {avenues.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-3 text-ink-700">{a.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{a.events}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(a.participants)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(a.beneficiaries)}</td>
                      <td className="py-2 pl-3 text-right tabular-nums">{formatCurrency(a.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top event chairs</CardTitle>
            </CardHeader>
            <CardBody>
              {chairs.length === 0 ? (
                <p className="text-sm text-ink-500">No chaired events recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {chairs.map((chair) => (
                    <li key={chair.user.id} className="flex items-center gap-3">
                      <Avatar name={chair.user.name} src={chair.user.image} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{chair.user.name}</span>
                      <span className="text-sm font-medium tabular-nums text-ink-800">{chair.events}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top collaborating organisations</CardTitle>
            </CardHeader>
            <CardBody>
              {partners.length === 0 ? (
                <p className="text-sm text-ink-500">No collaborations recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {partners.map((partner) => (
                    <li key={partner.orgName} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm text-ink-700">{partner.orgName}</span>
                      <span className="text-sm font-medium tabular-nums text-ink-800">{partner.events}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
