import { describe, expect, it } from 'vitest';
import {
  can,
  canApproveEvent,
  canDeleteEvent,
  canEditEvent,
  canReviewEvent,
  canSubmitEvent,
  canViewEvent,
  visibleNav,
} from '@/lib/permissions';

const boardMember = { id: 'u-board', role: 'BOARD_MEMBER' as const };
const otherMember = { id: 'u-other', role: 'BOARD_MEMBER' as const };
const president = { id: 'u-pres', role: 'PRESIDENT' as const };
const secretary = { id: 'u-sec', role: 'SECRETARY' as const };
const directorCS = { id: 'u-dir', role: 'DIRECTOR' as const, avenueId: 'av-cs' };
const viewer = { id: 'u-view', role: 'VIEWER' as const };
const admin = { id: 'u-admin', role: 'SUPER_ADMIN' as const };

const draft = { createdById: 'u-board', avenueId: 'av-cs', status: 'DRAFT' as const };
const submitted = { ...draft, status: 'SUBMITTED' as const };
const approved = { ...draft, status: 'APPROVED' as const, lockedForEdits: true };

describe('role permissions', () => {
  it('gives board members only reporting rights', () => {
    expect(can(boardMember, 'event.create')).toBe(true);
    expect(can(boardMember, 'event.viewAll')).toBe(false);
    expect(can(boardMember, 'event.approve')).toBe(false);
    expect(can(boardMember, 'settings.manage')).toBe(false);
  });

  it('gives viewers nothing but read access', () => {
    expect(can(viewer, 'event.create')).toBe(false);
    expect(canViewEvent(viewer, approved)).toBe(true);
    expect(canViewEvent(viewer, draft)).toBe(false);
    expect(canEditEvent(viewer, draft)).toBe(false);
  });

  it('hides admin navigation from board members', () => {
    const nav = visibleNav('BOARD_MEMBER');
    expect(nav.members).toBe(false);
    expect(nav.settings).toBe(false);
    expect(nav.reportEvent).toBe(true);
  });
});

describe('draft privacy', () => {
  it('keeps another member out of a private draft', () => {
    expect(canViewEvent(otherMember, draft)).toBe(false);
    expect(canEditEvent(otherMember, draft)).toBe(false);
  });

  it('lets the author see and edit their own draft', () => {
    expect(canViewEvent(boardMember, draft)).toBe(true);
    expect(canEditEvent(boardMember, draft)).toBe(true);
    expect(canSubmitEvent(boardMember, draft)).toBe(true);
  });

  it('lets an admin see everything', () => {
    expect(canViewEvent(admin, draft)).toBe(true);
    expect(canViewEvent(president, draft)).toBe(true);
  });
});

describe('review rules', () => {
  it('never lets someone approve their own event', () => {
    const ownSubmission = { ...submitted, createdById: president.id };
    expect(canReviewEvent(president, ownSubmission)).toBe(false);
    expect(canApproveEvent(president, ownSubmission)).toBe(false);
  });

  it('never lets the chair approve their own event', () => {
    const chairedByPresident = { ...submitted, createdById: 'someone', chairId: president.id };
    expect(canApproveEvent(president, chairedByPresident)).toBe(false);
  });

  it('allows the president and secretary to approve others’ submissions', () => {
    expect(canApproveEvent(president, submitted)).toBe(true);
    expect(canApproveEvent(secretary, submitted)).toBe(true);
  });

  it('restricts a director to their own avenue', () => {
    expect(canApproveEvent(directorCS, submitted)).toBe(true);
    expect(canApproveEvent(directorCS, { ...submitted, avenueId: 'av-other' })).toBe(false);
  });

  it('does not let board members review', () => {
    expect(canReviewEvent(otherMember, submitted)).toBe(false);
  });

  it('only reviews events that are actually in the queue', () => {
    expect(canReviewEvent(president, draft)).toBe(false);
    expect(canReviewEvent(president, approved)).toBe(false);
  });
});

describe('locking', () => {
  it('locks approved events for the author', () => {
    expect(canEditEvent(boardMember, approved)).toBe(false);
  });

  it('lets a president unlock and edit', () => {
    expect(can(president, 'event.unlock')).toBe(true);
    expect(canEditEvent(president, approved)).toBe(true);
  });

  it('lets the author edit again after a correction request', () => {
    expect(canEditEvent(boardMember, { ...draft, status: 'CORRECTION_REQUIRED' })).toBe(true);
    expect(canSubmitEvent(boardMember, { ...draft, status: 'CORRECTION_REQUIRED' })).toBe(true);
  });

  it('protects approved events from deletion by non-admins', () => {
    expect(canDeleteEvent(boardMember, approved)).toBe(false);
    expect(canDeleteEvent(boardMember, draft)).toBe(true);
    expect(canDeleteEvent(admin, approved)).toBe(true);
  });
});
