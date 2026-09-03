import { prisma } from '@/lib/prisma';
import { can, type ActorLike } from '@/lib/permissions';
import { eventInclude } from '@/server/events';
import type { Prisma } from '@/generated/prisma/client';
import type { EventStatus } from '@/generated/prisma/enums';

export type EventQuery = {
  q?: string;
  status?: string;
  avenueId?: string;
  chairId?: string;
  directorId?: string;
  projectId?: string;
  month?: string; // 2026-01
  year?: string; // 2026-27 (Rotaract year)
  from?: string;
  to?: string;
  beneficiary?: string;
  partner?: string;
  mine?: string;
  page?: number;
  perPage?: number;
  sort?: string;
};

function rotaractYearRange(label: string) {
  const [startStr] = label.split('-');
  const start = Number(startStr);
  if (!Number.isFinite(start)) return null;
  return { gte: new Date(Date.UTC(start, 6, 1)), lt: new Date(Date.UTC(start + 1, 6, 1)) };
}

function monthRange(key: string) {
  const [y, m] = key.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

/**
 * Row-level visibility is enforced here, not in the UI: a board member's query
 * is silently narrowed to their own reports, a director's to their avenue.
 */
export function visibilityWhere(actor: ActorLike): Prisma.EventWhereInput {
  if (can(actor, 'event.viewAll')) return {};
  if (actor.role === 'DIRECTOR') {
    return {
      OR: [
        { avenueId: actor.avenueId ?? '__none__' },
        { createdById: actor.id },
        { chairId: actor.id },
      ],
    };
  }
  if (actor.role === 'VIEWER') {
    return { OR: [{ status: 'APPROVED' }, { createdById: actor.id }] };
  }
  return { OR: [{ createdById: actor.id }, { chairId: actor.id }] };
}

export function buildEventWhere(query: EventQuery, actor: ActorLike): Prisma.EventWhereInput {
  const and: Prisma.EventWhereInput[] = [{ deletedAt: null }, visibilityWhere(actor)];

  if (query.mine === '1') and.push({ OR: [{ createdById: actor.id }, { chairId: actor.id }] });

  if (query.q) {
    const q = query.q.trim();
    and.push({
      OR: [
        { eventName: { contains: q, mode: 'insensitive' } },
        { eventId: { contains: q, mode: 'insensitive' } },
        { venue: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { projectWith: { contains: q, mode: 'insensitive' } },
        { projectName: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { chairNameText: { contains: q, mode: 'insensitive' } },
        { chair: { name: { contains: q, mode: 'insensitive' } } },
        { createdBy: { name: { contains: q, mode: 'insensitive' } } },
        { collaborators: { some: { orgName: { contains: q, mode: 'insensitive' } } } },
        { avenue: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }

  if (query.status && query.status !== 'ALL') {
    const statuses = query.status.split(',').filter(Boolean) as EventStatus[];
    if (statuses.length) and.push({ status: { in: statuses } });
  }
  if (query.avenueId && query.avenueId !== 'ALL') and.push({ avenueId: query.avenueId });
  if (query.chairId && query.chairId !== 'ALL') and.push({ chairId: query.chairId });
  if (query.directorId) and.push({ directorId: query.directorId });
  if (query.projectId && query.projectId !== 'ALL') and.push({ projectId: query.projectId });
  if (query.beneficiary && query.beneficiary !== 'ALL') {
    and.push({ beneficiaries: { some: { category: query.beneficiary as never } } });
  }
  if (query.partner) and.push({ collaborators: { some: { orgName: { contains: query.partner, mode: 'insensitive' } } } });

  const dateFilters: Prisma.DateTimeFilter = {};
  if (query.month) Object.assign(dateFilters, monthRange(query.month) ?? {});
  if (query.year) Object.assign(dateFilters, rotaractYearRange(query.year) ?? {});
  if (query.from) dateFilters.gte = new Date(query.from);
  if (query.to) dateFilters.lte = new Date(`${query.to}T23:59:59`);
  if (Object.keys(dateFilters).length) and.push({ eventDate: dateFilters });

  return { AND: and };
}

const SORTS: Record<string, Prisma.EventOrderByWithRelationInput> = {
  date_desc: { eventDate: 'desc' },
  date_asc: { eventDate: 'asc' },
  updated_desc: { updatedAt: 'desc' },
  name_asc: { eventName: 'asc' },
  cost_desc: { eventCost: 'desc' },
  participants_desc: { totalParticipants: 'desc' },
};

export async function searchEvents(query: EventQuery, actor: ActorLike) {
  const where = buildEventWhere(query, actor);
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(200, Math.max(5, query.perPage ?? 25));

  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: eventInclude,
      orderBy: SORTS[query.sort ?? 'date_desc'] ?? SORTS.date_desc,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.event.count({ where }),
  ]);

  return { rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Global search across events, members and projects (§54). */
export async function globalSearch(term: string, actor: ActorLike) {
  const q = term.trim();
  if (q.length < 2) return { events: [], members: [], projects: [] };

  const [events, members, projects] = await Promise.all([
    prisma.event.findMany({
      where: {
        AND: [
          { deletedAt: null },
          visibilityWhere(actor),
          {
            OR: [
              { eventName: { contains: q, mode: 'insensitive' } },
              { eventId: { contains: q, mode: 'insensitive' } },
              { projectName: { contains: q, mode: 'insensitive' } },
              { projectWith: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      take: 8,
      orderBy: { eventDate: 'desc' },
      include: {
        avenue: true,
        chair: { select: { name: true } },
        driveFolder: true,
        photos: { take: 1, orderBy: { sortOrder: 'asc' } },
        reports: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    }),
    can(actor, 'event.viewAll')
      ? prisma.user.findMany({
          where: { deletedAt: null, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
          take: 5,
          select: { id: true, name: true, email: true, image: true, role: true },
        })
      : Promise.resolve([]),
    prisma.project.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 5 }),
  ]);

  return { events, members, projects };
}
