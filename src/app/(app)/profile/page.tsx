import { requireUser } from '@/server/session';
import { prisma } from '@/lib/prisma';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { ROLE_LABELS, ROLE_PERMISSION_HINTS } from '@/lib/role-hints';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const user = await requireUser();
  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { boardPosition: true, avenue: true, _count: { select: { createdEvents: true, chairedEvents: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-4">
        <Avatar name={record.name} src={record.image} size={64} />
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{record.name}</h1>
          <p className="text-sm text-ink-500">
            {ROLE_LABELS[record.role]}
            {record.boardPosition ? ` · ${record.boardPosition.title}` : ''}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardBody>
          <dl className="divide-y divide-ink-100 text-sm">
            {[
              ['Email', record.email],
              ['Phone', record.phone ?? '—'],
              ['Avenue', record.avenue?.name ?? '—'],
              ['Reports created', String(record._count.createdEvents)],
              ['Events chaired', String(record._count.chairedEvents)],
              ['Member since', formatDate(record.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-500">
            Name, role and avenue are managed by your club admin so that every report stays consistent.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What your role can do</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="space-y-1.5 text-sm text-ink-600">
            {ROLE_PERMISSION_HINTS[record.role].map((hint) => (
              <li key={hint} className="flex gap-2">
                <span className="text-brand-500">•</span>
                {hint}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
