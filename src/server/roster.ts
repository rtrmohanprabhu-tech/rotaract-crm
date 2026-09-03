import { prisma } from '@/lib/prisma';

/**
 * The Members page shows the official club roster, not raw Users — demo/seed
 * accounts (`*@rotaract.demo`) are fixtures for tests and local dev, never
 * real club data (§ Members/Admin roster import).
 *
 * A "row" is either a RosterMember (linked to a User or not) or a real,
 * non-demo User that predates the roster and has no RosterMember yet — so
 * nothing with a real login becomes invisible just because it isn't on the
 * official list.
 */
export type MemberRow = {
  kind: 'roster' | 'standalone-user';
  id: string; // RosterMember.id for 'roster' rows, User.id for 'standalone-user' rows
  name: string;
  email: string | null;
  phone: string | null;
  rotaractId: string | null;
  image: string | null;
  portfolio: string | null;
  role: string; // live role if linked/standalone, otherwise the roster's intended role
  hasLogin: boolean;
  isActive: boolean;
  userId: string | null;
  avenueId: string | null;
  boardPositionId: string | null;
  eventCount: number;
};

const DEMO_EMAIL_SUFFIX = '@rotaract.demo';

export async function getMemberRows(): Promise<MemberRow[]> {
  const [rosterEntries, linkedUserIds] = await Promise.all([
    prisma.rosterMember.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          include: { boardPosition: { select: { title: true } }, _count: { select: { createdEvents: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.rosterMember.findMany({ where: { userId: { not: null } }, select: { userId: true } }),
  ]);

  const rosterRows: MemberRow[] = rosterEntries.map((r) => ({
    kind: 'roster',
    id: r.id,
    name: r.name,
    email: r.user?.email ?? null,
    phone: r.user?.phone ?? null,
    rotaractId: r.user?.rotaractId ?? null,
    image: r.user?.image ?? null,
    portfolio: r.portfolio,
    role: r.user?.role ?? r.intendedRole,
    hasLogin: Boolean(r.user),
    isActive: r.user ? r.user.isActive : r.isActive,
    userId: r.userId,
    avenueId: r.user?.avenueId ?? null,
    boardPositionId: r.user?.boardPositionId ?? null,
    eventCount: r.user?._count.createdEvents ?? 0,
  }));

  const linkedIds = new Set(linkedUserIds.map((r) => r.userId).filter(Boolean) as string[]);
  const standaloneUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      id: { notIn: [...linkedIds] },
      email: { not: { endsWith: DEMO_EMAIL_SUFFIX } },
    },
    include: { boardPosition: { select: { title: true } }, _count: { select: { createdEvents: true } } },
    orderBy: { name: 'asc' },
  });

  const standaloneRows: MemberRow[] = standaloneUsers.map((u) => ({
    kind: 'standalone-user',
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    rotaractId: u.rotaractId,
    image: u.image,
    portfolio: u.boardPosition?.title ?? null,
    role: u.role,
    hasLogin: true,
    isActive: u.isActive,
    userId: u.id,
    avenueId: u.avenueId,
    boardPositionId: u.boardPositionId,
    eventCount: u._count.createdEvents,
  }));

  return [...rosterRows, ...standaloneRows].sort((a, b) => a.name.localeCompare(b.name));
}
