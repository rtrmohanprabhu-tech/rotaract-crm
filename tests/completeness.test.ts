import { describe, expect, it } from 'vitest';
import { computeCompleteness } from '@/lib/completeness';

const policy = {
  minPhotos: 3,
  requiredFields: ['eventName', 'eventDate', 'avenueId', 'chairId', 'venue', 'participation', 'beneficiaries', 'description', 'photos'],
};

const complete = {
  eventName: 'Care2Cook',
  eventDate: '2026-01-30',
  avenueId: 'av-1',
  chairId: 'u-1',
  eventType: 'PHYSICAL',
  venue: 'Madhukarai Government School',
  rotaractorsPresent: 14,
  rotariansPresent: 0,
  councilPresent: 0,
  guestsPresent: 6,
  beneficiaryCount: 2,
  directBeneficiaries: 60,
  indirectBeneficiaries: 180,
  description: 'We donated a mixer grinder to the school kitchen so nutritious meals can be prepared for the students.',
  photoCount: 3,
};

describe('completeness scoring', () => {
  it('lets a complete report submit', () => {
    const result = computeCompleteness(complete, policy);
    expect(result.canSubmit).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
    expect(result.score).toBeGreaterThan(70);
    expect(result.summary).toBe('Your report is ready to submit.');
  });

  it('blocks submission when required photos are missing', () => {
    const result = computeCompleteness({ ...complete, photoCount: 1 }, policy);
    expect(result.canSubmit).toBe(false);
    expect(result.missingRequired.map((c) => c.key)).toContain('photos');
    expect(result.missingRequired[0].hint).toContain('1 of 3');
  });

  it('never blocks on optional items', () => {
    const result = computeCompleteness(complete, policy);
    expect(result.missingOptional.length).toBeGreaterThan(0);
    expect(result.canSubmit).toBe(true);
  });

  it('accepts a platform instead of a venue for online events', () => {
    const online = { ...complete, eventType: 'ONLINE', venue: '', platform: 'Google Meet' };
    expect(computeCompleteness(online, policy).canSubmit).toBe(true);
  });

  it('treats a too-short description as missing', () => {
    const result = computeCompleteness({ ...complete, description: 'We did it.' }, policy);
    expect(result.canSubmit).toBe(false);
    expect(result.missingRequired.map((c) => c.key)).toContain('description');
  });

  it('honours an admin policy that requires nothing', () => {
    const result = computeCompleteness({ eventName: 'x' }, { minPhotos: 0, requiredFields: [] });
    expect(result.canSubmit).toBe(true);
  });

  it('requires participation to be more than zero', () => {
    const result = computeCompleteness(
      { ...complete, rotaractorsPresent: 0, rotariansPresent: 0, councilPresent: 0, guestsPresent: 0 },
      policy,
    );
    expect(result.missingRequired.map((c) => c.key)).toContain('participation');
  });

  it('scores an empty report low and a full one high', () => {
    const empty = computeCompleteness({}, policy);
    expect(empty.score).toBeLessThan(20);
    expect(computeCompleteness(complete, policy).score).toBeGreaterThan(empty.score);
  });
});
