import { prisma } from '@/lib/prisma';
import type { NotificationType } from '@/generated/prisma/enums';

export type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
};

export async function notify({ userIds, type, title, body, link }: NotifyInput) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({ userId, type, title, body, link })),
    });
  } catch (error) {
    console.error('[notifications] failed to create', type, error);
  }
}

/** Everyone who can act on a submitted report. */
export async function reviewerIds(avenueId?: string | null): Promise<string[]> {
  const reviewers = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { role: { in: ['SUPER_ADMIN', 'PRESIDENT', 'SECRETARY'] } },
        ...(avenueId ? [{ role: 'DIRECTOR' as const, avenueId }] : []),
      ],
    },
    select: { id: true },
  });
  return reviewers.map((r) => r.id);
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, take = 30) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function markRead(userId: string, ids?: string[]) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}
