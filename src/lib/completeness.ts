/**
 * Live report-completeness scoring (§9).
 *
 * Required checks block submission; recommended checks only lower the score and
 * show as gentle nudges. Which checks are required is admin-configurable
 * (ClubSettings.requiredFields), so this function takes the policy as input.
 */

export type CompletenessInput = {
  eventName?: string | null;
  eventDate?: Date | string | null;
  avenueId?: string | null;
  chairId?: string | null;
  chairNameText?: string | null;
  eventType?: string | null;
  venue?: string | null;
  platform?: string | null;
  rotaractorsPresent?: number | null;
  rotariansPresent?: number | null;
  councilPresent?: number | null;
  guestsPresent?: number | null;
  totalParticipants?: number | null;
  beneficiaryCount?: number;
  directBeneficiaries?: number | null;
  indirectBeneficiaries?: number | null;
  description?: string | null;
  objective?: string | null;
  impact?: string | null;
  photoCount?: number;
  posterCount?: number;
  documentCount?: number;
  socialLinkCount?: number;
  hasExpenses?: boolean | null;
  eventCost?: number | string | null;
  fundingSource?: string | null;
  isCollaboration?: boolean | null;
  collaboratorCount?: number;
};

export type CompletenessPolicy = {
  minPhotos: number;
  requiredFields: string[];
};

export type CheckResult = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  hint?: string;
};

export type CompletenessResult = {
  score: number;
  checks: CheckResult[];
  missingRequired: CheckResult[];
  missingOptional: CheckResult[];
  canSubmit: boolean;
  summary: string;
};

const nonEmpty = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;

export function computeCompleteness(
  input: CompletenessInput,
  policy: CompletenessPolicy = { minPhotos: 3, requiredFields: [] },
): CompletenessResult {
  const req = (key: string) => policy.requiredFields.includes(key);
  const participation =
    (input.rotaractorsPresent ?? 0) +
    (input.rotariansPresent ?? 0) +
    (input.councilPresent ?? 0) +
    (input.guestsPresent ?? 0);
  const isOnline = input.eventType === 'ONLINE';

  const checks: CheckResult[] = [
    { key: 'eventName', label: 'Event name', ok: nonEmpty(input.eventName), required: req('eventName') },
    { key: 'eventDate', label: 'Event date', ok: Boolean(input.eventDate), required: req('eventDate') },
    { key: 'avenueId', label: 'Avenue of service', ok: nonEmpty(input.avenueId), required: req('avenueId') },
    {
      key: 'chairId',
      label: 'Event chair',
      ok: nonEmpty(input.chairId) || nonEmpty(input.chairNameText),
      required: req('chairId'),
    },
    {
      key: 'venue',
      label: isOnline ? 'Platform' : 'Venue',
      ok: isOnline ? nonEmpty(input.platform) || nonEmpty(input.venue) : nonEmpty(input.venue),
      required: req('venue'),
    },
    {
      key: 'participation',
      label: 'Participation numbers',
      ok: participation > 0,
      required: req('participation'),
      hint: 'Add how many Rotaractors, Rotarians, council members and guests attended.',
    },
    {
      key: 'beneficiaries',
      label: 'Beneficiaries',
      ok: (input.beneficiaryCount ?? 0) > 0,
      required: req('beneficiaries'),
      hint: 'Pick at least one group that benefited.',
    },
    {
      key: 'description',
      label: 'Description',
      ok: nonEmpty(input.description) && (input.description?.trim().length ?? 0) >= 40,
      required: req('description'),
      hint: 'A couple of sentences is enough.',
    },
    {
      key: 'photos',
      label: `Photos (min ${policy.minPhotos})`,
      ok: (input.photoCount ?? 0) >= policy.minPhotos,
      required: req('photos'),
      hint: `${input.photoCount ?? 0} of ${policy.minPhotos} uploaded.`,
    },
    // Recommended, never blocking
    { key: 'time', label: 'Start time', ok: true, required: false },
    { key: 'objective', label: 'Objective', ok: nonEmpty(input.objective), required: false },
    { key: 'impact', label: 'Impact note', ok: nonEmpty(input.impact), required: false },
    { key: 'poster', label: 'Event poster', ok: (input.posterCount ?? 0) > 0, required: false },
    { key: 'documents', label: 'Supporting document', ok: (input.documentCount ?? 0) > 0, required: false },
    { key: 'social', label: 'Social media link', ok: (input.socialLinkCount ?? 0) > 0, required: false },
    {
      key: 'financials',
      label: 'Cost details',
      ok: !input.hasExpenses || (Number(input.eventCost ?? 0) > 0 && nonEmpty(input.fundingSource)),
      required: false,
    },
    {
      key: 'collaboration',
      label: 'Partner organisation details',
      ok: !input.isCollaboration || (input.collaboratorCount ?? 0) > 0,
      required: false,
    },
    {
      key: 'beneficiaryNumbers',
      label: 'Beneficiary headcount',
      ok: (input.directBeneficiaries ?? 0) + (input.indirectBeneficiaries ?? 0) > 0,
      required: false,
    },
  ];

  // Required checks carry twice the weight of recommended ones.
  const weight = (c: CheckResult) => (c.required ? 2 : 1);
  const total = checks.reduce((sum, c) => sum + weight(c), 0);
  const earned = checks.reduce((sum, c) => sum + (c.ok ? weight(c) : 0), 0);
  const score = total === 0 ? 100 : Math.round((earned / total) * 100);

  const missingRequired = checks.filter((c) => c.required && !c.ok);
  const missingOptional = checks.filter((c) => !c.required && !c.ok);

  return {
    score,
    checks,
    missingRequired,
    missingOptional,
    canSubmit: missingRequired.length === 0,
    summary:
      missingRequired.length === 0
        ? 'Your report is ready to submit.'
        : `Please complete ${missingRequired.length} required ${missingRequired.length === 1 ? 'item' : 'items'}.`,
  };
}
