import type { EventStatus, Role } from '@/generated/prisma/enums';

/**
 * Role-based access control (§4, §68).
 *
 * Pure functions with no database or session dependency so they can be unit
 * tested and reused on both the server and the client.
 */

export type Permission =
  | 'event.create'
  | 'event.viewAll'
  | 'event.viewAvenue'
  | 'event.viewOwn'
  | 'event.editAny'
  | 'event.deleteAny'
  | 'event.review'
  | 'event.approve'
  | 'event.unlock'
  | 'report.generate'
  | 'analytics.view'
  | 'export.data'
  | 'members.manage'
  | 'settings.manage'
  | 'drive.manage'
  | 'projects.manage';

const P = <T extends Permission[]>(...p: T) => p;

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: P(
    'event.create', 'event.viewAll', 'event.viewAvenue', 'event.viewOwn', 'event.editAny',
    'event.deleteAny', 'event.review', 'event.approve', 'event.unlock', 'report.generate',
    'analytics.view', 'export.data', 'members.manage', 'settings.manage', 'drive.manage', 'projects.manage',
  ),
  PRESIDENT: P(
    'event.create', 'event.viewAll', 'event.viewAvenue', 'event.viewOwn', 'event.review',
    'event.approve', 'event.unlock', 'report.generate', 'analytics.view', 'export.data', 'projects.manage',
  ),
  SECRETARY: P(
    'event.create', 'event.viewAll', 'event.viewAvenue', 'event.viewOwn', 'event.review',
    'event.approve', 'report.generate', 'analytics.view', 'export.data', 'projects.manage',
  ),
  DIRECTOR: P('event.create', 'event.viewAvenue', 'event.viewOwn', 'event.review', 'event.approve', 'analytics.view'),
  BOARD_MEMBER: P('event.create', 'event.viewOwn'),
  VIEWER: P(),
};

export type ActorLike = {
  id: string;
  role: Role;
  avenueId?: string | null;
};

export type EventLike = {
  createdById: string;
  chairId?: string | null;
  avenueId: string;
  status: EventStatus;
  lockedForEdits?: boolean;
  deletedAt?: Date | null;
};

export function can(actor: ActorLike | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return ROLE_PERMISSIONS[actor.role]?.includes(permission) ?? false;
}

export function isAdminRole(role: Role) {
  return role === 'SUPER_ADMIN' || role === 'PRESIDENT' || role === 'SECRETARY';
}

/** Directors review their own avenue only; admins see everything. */
export function canViewEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  if (!actor) return false;
  if (event.deletedAt && actor.role !== 'SUPER_ADMIN') return false;
  if (can(actor, 'event.viewAll')) return true;
  if (event.createdById === actor.id || event.chairId === actor.id) return true;
  if (actor.role === 'DIRECTOR' && actor.avenueId && actor.avenueId === event.avenueId) return true;
  // Viewers/members may read approved reports only (§4).
  if (actor.role === 'VIEWER' && event.status === 'APPROVED') return true;
  return false;
}

/**
 * A board member owns their draft until it is approved. Approved events are
 * locked; only roles with `event.unlock` can reopen them.
 */
export function canEditEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  if (!actor) return false;
  if (event.deletedAt) return false;
  if (event.status === 'APPROVED' || event.lockedForEdits) return can(actor, 'event.unlock');
  if (event.status === 'ARCHIVED') return can(actor, 'event.editAny');
  const isOwner = event.createdById === actor.id || event.chairId === actor.id;
  if (isOwner && (event.status === 'DRAFT' || event.status === 'CORRECTION_REQUIRED')) return true;
  if (can(actor, 'event.editAny')) return true;
  return false;
}

export function canSubmitEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  if (!actor) return false;
  const isOwner = event.createdById === actor.id || event.chairId === actor.id;
  const submittable = event.status === 'DRAFT' || event.status === 'CORRECTION_REQUIRED';
  return submittable && (isOwner || can(actor, 'event.editAny'));
}

/** §68: nobody approves their own event, whatever their role. */
export function canReviewEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  if (!actor) return false;
  if (event.createdById === actor.id || event.chairId === actor.id) return false;
  if (!can(actor, 'event.review')) return false;
  if (actor.role === 'DIRECTOR' && actor.avenueId !== event.avenueId) return false;
  return ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(event.status);
}

export function canApproveEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  return canReviewEvent(actor, event) && can(actor, 'event.approve');
}

export function canDeleteEvent(actor: ActorLike | null | undefined, event: EventLike): boolean {
  if (!actor) return false;
  if (can(actor, 'event.deleteAny')) return true;
  return event.status === 'DRAFT' && event.createdById === actor.id;
}

/** Which nav entries a role can see (§60, §61). */
export function visibleNav(role: Role) {
  const admin = isAdminRole(role);
  return {
    dashboard: true,
    myEvents: true,
    reportEvent: can({ id: '', role }, 'event.create'),
    allEvents: can({ id: '', role }, 'event.viewAll') || role === 'DIRECTOR' || role === 'VIEWER',
    reviews: can({ id: '', role }, 'event.review'),
    analytics: can({ id: '', role }, 'analytics.view'),
    reports: can({ id: '', role }, 'report.generate'),
    projects: true,
    members: admin,
    drive: can({ id: '', role }, 'drive.manage'),
    settings: can({ id: '', role }, 'settings.manage'),
  };
}
