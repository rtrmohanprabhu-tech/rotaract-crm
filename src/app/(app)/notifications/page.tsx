import Link from 'next/link';
import { Bell } from 'lucide-react';
import { requireUser } from '@/server/session';
import { listNotifications, markRead } from '@/server/notifications';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id, 60);
  // Opening the page is an explicit read.
  await markRead(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Notifications</h1>
        <p className="mt-1 text-sm text-ink-500">Submissions, corrections, approvals and overdue reminders.</p>
      </header>

      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="Nothing yet" description="You will be notified when a report needs your attention." />
      ) : (
        <Card>
          <CardBody className="divide-y divide-ink-100 p-0">
            {items.map((item) => (
              <Link key={item.id} href={item.link ?? '#'} className="block px-5 py-4 transition hover:bg-ink-50">
                <p className="text-sm font-medium text-ink-800">{item.title}</p>
                {item.body ? <p className="mt-0.5 text-sm text-ink-600">{item.body}</p> : null}
                <p className="mt-1 text-xs text-ink-400">{relativeTime(item.createdAt)}</p>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
