import Link from 'next/link';
import { redirect } from 'next/navigation';
import { History } from 'lucide-react';
import { requireUser } from '@/server/session';
import { prisma } from '@/lib/prisma';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { Avatar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { formatDateTime } from '@/lib/utils';
import type { Prisma } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activity log' };

const PER_PAGE = 40;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard');

  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const q = one(raw.q).trim();
  const entityType = one(raw.entityType);
  const page = Math.max(1, Number(one(raw.page)) || 1);

  const where: Prisma.AuditLogWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
            { actorLabel: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [entries, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { actor: { select: { id: true, name: true, image: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ['entityType'], select: { entityType: true }, orderBy: { entityType: 'asc' } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (entityType) params.set('entityType', entityType);
    params.set('page', String(next));
    return `/activity?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Activity log</h1>
        <p className="mt-1 text-sm text-ink-500">Every tracked action across members, events and club settings.</p>
      </header>

      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" action="/activity">
        <Input name="q" defaultValue={q} placeholder="Search by summary, action or actor…" aria-label="Search activity" />
        <Select name="entityType" defaultValue={entityType} aria-label="Filter by entity type">
          <option value="">All entities</option>
          {entityTypes.map((e) => (
            <option key={e.entityType} value={e.entityType}>
              {e.entityType}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {entries.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="Nothing recorded yet" description="Actions will appear here as members use the app." />
      ) : (
        <Card>
          <CardBody className="divide-y divide-ink-100 p-0">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                <Avatar name={entry.actor?.name ?? entry.actorLabel} src={entry.actor?.image} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800">{entry.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {entry.action} · {entry.entityType}#{entry.entityId.slice(0, 8)} · {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)}>
              <Button variant="secondary" size="sm">
                Previous
              </Button>
            </Link>
          ) : null}
          <span className="text-sm text-ink-500">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)}>
              <Button variant="secondary" size="sm">
                Next
              </Button>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
