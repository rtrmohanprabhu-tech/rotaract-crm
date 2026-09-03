import { AppShell } from '@/components/layout/app-shell';
import { mobileNavForRole, navForRole } from '@/components/layout/nav';
import { requireUser } from '@/server/session';
import { getClubSettings } from '@/server/settings';
import { unreadCount } from '@/server/notifications';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, unread] = await Promise.all([getClubSettings(), unreadCount(user.id)]);

  return (
    <AppShell
      user={user}
      clubName={settings.clubName}
      nav={navForRole(user.role)}
      mobileNav={mobileNavForRole(user.role)}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
