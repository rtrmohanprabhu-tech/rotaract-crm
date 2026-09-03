'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  HardDrive,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/constants';
import { Avatar } from '@/components/ui/misc';
import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import type { NavItem } from './nav';
import type { Role } from '@/generated/prisma/enums';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  CalendarDays,
  ClipboardCheck,
  BarChart3,
  FileText,
  Layers,
  Users,
  HardDrive,
  Settings,
};

export function AppShell({
  user,
  clubName,
  nav,
  mobileNav,
  unread,
  children,
}: {
  user: { id: string; name: string; email: string; image?: string | null; role: Role };
  clubName: string;
  nav: NavItem[];
  mobileNav: NavItem[];
  unread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => setDrawerOpen(false), [pathname]);

  const isActive = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Main">
      {(['main', 'admin'] as const).map((group) => {
        const items = nav.filter((i) => i.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            {group === 'admin' ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Club management</p>
            ) : null}
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = isActive(item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-800',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px]', active ? 'text-brand-600' : 'text-ink-400')} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">R</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-800" title={clubName}>{clubName}</p>
            <p className="text-[11px] text-ink-500">Event Reporting CRM</p>
          </div>
        </div>
        <div className="scroll-area flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="border-t border-ink-100 p-3">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink-50">
            <Avatar name={user.name} src={user.image} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink-800">{user.name}</span>
              <span className="block truncate text-xs text-ink-500">{ROLE_LABELS[user.role]}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-500 transition hover:bg-ink-100 hover:text-ink-700"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-ink-100 px-4">
              <span className="text-sm font-semibold text-ink-800">{clubName}</span>
              <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="scroll-area flex-1 overflow-y-auto">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-3 border-t border-ink-100 px-5 py-4 text-sm text-ink-600"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur lg:pl-64">
        <div className="flex h-16 items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <Link
            href="/events/new"
            className="hidden items-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 sm:inline-flex"
          >
            <PlusCircle className="h-4 w-4" /> Report Event
          </Link>
          <NotificationBell initialUnread={unread} />
          <Link href="/profile" className="lg:hidden">
            <Avatar name={user.name} src={user.image} size={34} />
          </Link>
        </div>
      </header>

      <main className="px-3 pb-28 pt-4 sm:px-5 sm:pb-10 lg:pl-[17.5rem] lg:pr-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        <ul className="grid grid-cols-4">
          {mobileNav.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
                    active ? 'text-brand-600' : 'text-ink-500',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  {item.label.replace('Report Event', 'Report')}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export { Bell };
