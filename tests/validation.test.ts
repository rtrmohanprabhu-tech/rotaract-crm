import { describe, expect, it } from 'vitest';
import { eventDraftSchema, eventSubmitSchema, flattenZodError, memberSchema } from '@/lib/validation';

const base = {
  eventName: 'Care2Cook',
  eventDate: '2026-01-30',
  avenueId: 'av-1',
  startTime: '11:30',
  endTime: '13:30',
  rotaractorsPresent: 14,
  eventCost: 4534,
  hasExpenses: true,
  fundingSource: 'CLUB_FUND',
};

describe('draft validation', () => {
  it('accepts a minimal draft', () => {
    const result = eventDraftSchema.safeParse({ eventName: 'Just a name' });
    expect(result.success).toBe(true);
  });

  it('rejects a name that is too short', () => {
    const result = eventDraftSchema.safeParse({ eventName: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects negative numbers', () => {
    expect(eventDraftSchema.safeParse({ eventName: 'Valid name', rotaractorsPresent: -1 }).success).toBe(false);
    expect(eventDraftSchema.safeParse({ eventName: 'Valid name', eventCost: -5 }).success).toBe(false);
  });

  it('rejects fractional headcounts', () => {
    expect(eventDraftSchema.safeParse({ eventName: 'Valid name', rotariansPresent: 2.5 }).success).toBe(false);
  });

  it('coerces numeric strings from the form', () => {
    const result = eventDraftSchema.parse({ eventName: 'Valid name', rotaractorsPresent: '14' });
    expect(result.rotaractorsPresent).toBe(14);
  });
});

describe('submit validation', () => {
  it('accepts a full submission', () => {
    expect(eventSubmitSchema.safeParse(base).success).toBe(true);
  });

  it('requires a date and avenue', () => {
    const result = eventSubmitSchema.safeParse({ ...base, eventDate: undefined, avenueId: undefined });
    expect(result.success).toBe(false);
  });

  it('rejects an end time before the start time', () => {
    const result = eventSubmitSchema.safeParse({ ...base, startTime: '15:00', endTime: '11:00' });
    expect(result.success).toBe(false);
    if (!result.success) expect(flattenZodError(result.error).endTime).toMatch(/before start time/i);
  });

  it('requires a partner when collaboration is on', () => {
    const result = eventSubmitSchema.safeParse({ ...base, isCollaboration: true, collaborators: [] });
    expect(result.success).toBe(false);
  });

  it('requires a funding source when there are expenses', () => {
    const result = eventSubmitSchema.safeParse({ ...base, fundingSource: undefined });
    expect(result.success).toBe(false);
  });

  it('requires a project name when the event is part of a project', () => {
    const result = eventSubmitSchema.safeParse({ ...base, isPartOfProject: true });
    expect(result.success).toBe(false);
  });
});

describe('member validation', () => {
  it('rejects a bad email', () => {
    expect(memberSchema.safeParse({ name: 'Rtr. A', email: 'nope', role: 'BOARD_MEMBER' }).success).toBe(false);
  });

  it('rejects a short password but allows an empty one', () => {
    expect(memberSchema.safeParse({ name: 'Rtr. A', email: 'a@b.com', role: 'BOARD_MEMBER', password: 'short' }).success).toBe(false);
    expect(memberSchema.safeParse({ name: 'Rtr. A', email: 'a@b.com', role: 'BOARD_MEMBER', password: '' }).success).toBe(true);
  });
});
