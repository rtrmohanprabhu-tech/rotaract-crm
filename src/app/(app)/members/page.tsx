import { redirect } from 'next/navigation';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { getMemberRows } from '@/server/roster';
import { MemberManager } from '@/features/members/member-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Members' };

export default async function MembersPage() {
  const user = await requireUser();
  if (!can(user, 'members.manage')) redirect('/dashboard');

  const [rows, positions] = await Promise.all([
    getMemberRows(),
    prisma.boardPosition.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Members</h1>
        <p className="mt-1 text-sm text-ink-500">
          The official club roster. A member can be listed here before they have a login — create one when they're
          ready to sign in.
        </p>
      </header>

      <MemberManager
        rows={rows}
        positions={positions.map((p) => ({ id: p.id, title: p.title }))}
        currentUserId={user.id}
      />
    </div>
  );
}
