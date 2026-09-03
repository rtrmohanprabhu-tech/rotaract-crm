import { redirect } from 'next/navigation';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getAvenues } from '@/server/settings';
import { MemberManager } from '@/features/members/member-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Members' };

export default async function MembersPage() {
  const user = await requireUser();
  if (!can(user, 'members.manage')) redirect('/dashboard');

  const [members, avenues, positions] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { boardPosition: { select: { title: true } }, _count: { select: { createdEvents: true } } },
    }),
    getAvenues(),
    prisma.boardPosition.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Members</h1>
        <p className="mt-1 text-sm text-ink-500">
          Only people listed here can sign in. Add a member before they try Google login.
        </p>
      </header>

      <MemberManager
        members={members}
        avenues={avenues.map((a) => ({ id: a.id, name: a.name }))}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        currentUserId={user.id}
      />
    </div>
  );
}
