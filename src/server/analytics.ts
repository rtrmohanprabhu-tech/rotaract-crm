import { prisma } from '@/lib/prisma';
import { getClubSettings } from '@/server/settings';
import { visibilityWhere } from '@/server/search';
import { overdueCutoff } from '@/server/events';
import type { ActorLike } from '@/lib/permissions';
import type { Prisma } from '@/generated/prisma/client';

/**
 * All dashboard/analytics aggregation (§7, §24, §45). Everything is derived
 * from typed columns, which is the whole point of the CRM.
 */

export type SeriesPoint = { label: string; key: string; events: number; participants: number; beneficiaries: number; cost: number };

function rotaractYearBounds(label: string) {
  const start = Number(label.split('-')[0]);
  const from = new Date(Date.UTC(start, 6, 1));
  const to = new Date(Date.UTC(start + 1, 6, 1));
  return { from, to };
}

export async function boardMemberStats(actor: ActorLike) {
  const mine: Prisma.EventWhereInput = {
    deletedAt: null,
    OR: [{ createdById: actor.id }, { chairId: actor.id }],
  };
  const settings = await getClubSettings();

  const [total, drafts, submitted, approved, corrections, overdue, recent] = await Promise.all([
    prisma.event.count({ where: mine }),
    prisma.event.count({ where: { ...mine, status: 'DRAFT' } }),
    prisma.event.count({ where: { ...mine, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.event.count({ where: { ...mine, status: 'APPROVED' } }),
    prisma.event.count({ where: { ...mine, status: 'CORRECTION_REQUIRED' } }),
    prisma.event.count({
      where: { ...mine, status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] }, eventDate: { lt: overdueCutoff(settings.reportingDeadlineHrs) } },
    }),
    prisma.event.findMany({
      where: mine,
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: { avenue: true, photos: { take: 1, orderBy: { sortOrder: 'asc' } } },
    }),
  ]);

  return { total, drafts, submitted, approved, corrections, overdue, recent };
}

export async function adminStats(yearLabel?: string) {
  const settings = await getClubSettings();
  const { from, to } = rotaractYearBounds(yearLabel ?? settings.currentYear);
  const base: Prisma.EventWhereInput = { deletedAt: null, eventDate: { gte: from, lt: to } };
  const approvedBase: Prisma.EventWhereInput = { ...base, status: 'APPROVED' };

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [totals, approvedAgg, thisMonth, pending, approvedCount, overdueCount, allCount] = await Promise.all([
    prisma.event.aggregate({
      where: base,
      _sum: { totalParticipants: true, totalBeneficiaries: true, eventCost: true },
      _count: true,
    }),
    prisma.event.aggregate({
      where: approvedBase,
      _sum: { totalParticipants: true, totalBeneficiaries: true, eventCost: true },
      _count: true,
    }),
    prisma.event.count({ where: { ...base, eventDate: { gte: monthStart } } }),
    prisma.event.count({ where: { ...base, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.event.count({ where: approvedBase }),
    prisma.event.count({
      where: {
        deletedAt: null,
        status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] },
        eventDate: { lt: overdueCutoff(settings.reportingDeadlineHrs) },
      },
    }),
    prisma.event.count({ where: { deletedAt: null } }),
  ]);

  return {
    yearLabel: yearLabel ?? settings.currentYear,
    totalEvents: totals._count,
    thisMonth,
    pending,
    approved: approvedCount,
    participants: totals._sum.totalParticipants ?? 0,
    beneficiaries: totals._sum.totalBeneficiaries ?? 0,
    expenditure: Number(totals._sum.eventCost ?? 0),
    approvedParticipants: approvedAgg._sum.totalParticipants ?? 0,
    overdue: overdueCount,
    allTimeEvents: allCount,
  };
}

export async function monthlySeries(yearLabel?: string): Promise<SeriesPoint[]> {
  const settings = await getClubSettings();
  const { from, to } = rotaractYearBounds(yearLabel ?? settings.currentYear);
  const events = await prisma.event.findMany({
    where: { deletedAt: null, eventDate: { gte: from, lt: to } },
    select: { eventDate: true, totalParticipants: true, totalBeneficiaries: true, eventCost: true },
  });

  const buckets = new Map<string, SeriesPoint>();
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, {
      key,
      label: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(d),
      events: 0,
      participants: 0,
      beneficiaries: 0,
      cost: 0,
    });
  }

  for (const e of events) {
    const key = `${e.eventDate.getUTCFullYear()}-${String(e.eventDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.events += 1;
    bucket.participants += e.totalParticipants;
    bucket.beneficiaries += e.totalBeneficiaries;
    bucket.cost += Number(e.eventCost);
  }

  return [...buckets.values()];
}

export async function avenueBreakdown(yearLabel?: string) {
  const settings = await getClubSettings();
  const { from, to } = rotaractYearBounds(yearLabel ?? settings.currentYear);
  const avenues = await prisma.avenue.findMany({ orderBy: { sortOrder: 'asc' } });
  const grouped = await prisma.event.groupBy({
    by: ['avenueId'],
    where: { deletedAt: null, eventDate: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { totalParticipants: true, totalBeneficiaries: true, eventCost: true },
  });

  return avenues.map((avenue) => {
    const row = grouped.find((g) => g.avenueId === avenue.id);
    return {
      id: avenue.id,
      name: avenue.name,
      color: avenue.color,
      events: row?._count._all ?? 0,
      participants: row?._sum.totalParticipants ?? 0,
      beneficiaries: row?._sum.totalBeneficiaries ?? 0,
      cost: Number(row?._sum.eventCost ?? 0),
    };
  });
}

export async function topChairs(limit = 5) {
  const grouped = await prisma.event.groupBy({
    by: ['chairId'],
    where: { deletedAt: null, chairId: { not: null } },
    _count: { _all: true },
    _sum: { totalParticipants: true },
    orderBy: { _count: { chairId: 'desc' } },
    take: limit,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.chairId!).filter(Boolean) } },
    select: { id: true, name: true, image: true },
  });
  return grouped.map((g) => ({
    user: users.find((u) => u.id === g.chairId) ?? { id: g.chairId!, name: 'Unknown', image: null },
    events: g._count._all,
    participants: g._sum.totalParticipants ?? 0,
  }));
}

export async function topPartners(limit = 5) {
  const grouped = await prisma.eventCollaborator.groupBy({
    by: ['orgName'],
    _count: { _all: true },
    orderBy: { _count: { orgName: 'desc' } },
    take: limit,
  });
  return grouped.map((g) => ({ orgName: g.orgName, events: g._count._all }));
}

/** Reporting health (§45): how much of what happened is actually on file. */
export async function reportingHealth() {
  const settings = await getClubSettings();
  const cutoff = overdueCutoff(settings.reportingDeadlineHrs);

  const [total, completed, pending, overdueRows] = await Promise.all([
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null, status: 'APPROVED' } }),
    prisma.event.count({ where: { deletedAt: null, status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'] } } }),
    prisma.event.findMany({
      where: { deletedAt: null, status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] }, eventDate: { lt: cutoff } },
      include: { createdBy: { select: { id: true, name: true, image: true, email: true } }, avenue: true },
      orderBy: { eventDate: 'asc' },
      take: 50,
    }),
  ]);

  const byMember = new Map<string, { user: { id: string; name: string; image: string | null }; count: number }>();
  for (const row of overdueRows) {
    const entry = byMember.get(row.createdById) ?? { user: row.createdBy, count: 0 };
    entry.count += 1;
    byMember.set(row.createdById, entry);
  }

  const avgCompleteness = await prisma.event.aggregate({ where: { deletedAt: null }, _avg: { completeness: true } });

  return {
    total,
    completed,
    pending,
    overdue: overdueRows.length,
    completedPct: total ? Math.round((completed / total) * 100) : 0,
    pendingPct: total ? Math.round((pending / total) * 100) : 0,
    avgCompleteness: Math.round(avgCompleteness._avg.completeness ?? 0),
    overdueRows,
    membersWithPending: [...byMember.values()].sort((a, b) => b.count - a.count),
  };
}

export async function pendingReviews(actor: ActorLike, take = 10) {
  return prisma.event.findMany({
    where: {
      AND: [
        { deletedAt: null, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        visibilityWhere(actor),
      ],
    },
    include: {
      avenue: true,
      chair: { select: { name: true, image: true } },
      createdBy: { select: { name: true, image: true } },
    },
    orderBy: { submittedAt: 'asc' },
    take,
  });
}

export async function driveSyncSummary() {
  const grouped = await prisma.event.groupBy({
    by: ['driveSyncStatus'],
    where: { deletedAt: null, status: { not: 'DRAFT' } },
    _count: { _all: true },
  });
  const get = (status: string) => grouped.find((g) => g.driveSyncStatus === status)?._count._all ?? 0;
  return {
    synced: get('SYNCED'),
    pending: get('PENDING') + get('SYNCING'),
    failed: get('FAILED'),
  };
}
