import type { Role } from '@/generated/prisma/enums';
import { visibleNav } from '@/lib/permissions';

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  group: 'main' | 'admin';
  mobile?: boolean;
};

const ALL: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', group: 'main', mobile: true },
  { key: 'myEvents', label: 'My Events', href: '/my-events', icon: 'FolderOpen', group: 'main', mobile: true },
  { key: 'reportEvent', label: 'Report Event', href: '/events/new', icon: 'PlusCircle', group: 'main', mobile: true },
  { key: 'allEvents', label: 'All Events', href: '/events', icon: 'CalendarDays', group: 'main' },
  { key: 'reviews', label: 'Pending Reviews', href: '/reviews', icon: 'ClipboardCheck', group: 'main' },
  { key: 'analytics', label: 'Analytics', href: '/analytics', icon: 'BarChart3', group: 'admin' },
  { key: 'reports', label: 'Reports', href: '/reports', icon: 'FileText', group: 'admin' },
  { key: 'projects', label: 'Projects', href: '/projects', icon: 'Layers', group: 'admin' },
  { key: 'members', label: 'Members', href: '/members', icon: 'Users', group: 'admin' },
  { key: 'drive', label: 'Google Drive', href: '/settings/drive', icon: 'HardDrive', group: 'admin' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'Settings', group: 'admin' },
  { key: 'activity', label: 'Activity Log', href: '/activity', icon: 'History', group: 'admin' },
];

export function navForRole(role: Role): NavItem[] {
  const allowed = visibleNav(role) as Record<string, boolean>;
  return ALL.filter((item) => allowed[item.key] !== false);
}

export function mobileNavForRole(role: Role): NavItem[] {
  const items = navForRole(role).filter((i) => i.mobile);
  const extra = navForRole(role).find((i) => i.key === 'reviews') ?? navForRole(role).find((i) => i.key === 'allEvents');
  return extra ? [...items, extra].slice(0, 4) : items;
}
