import { z } from 'zod';

/**
 * One schema set shared by the wizard (client) and the API/server actions
 * (server) — §66: no duplicated validation rules.
 */

const optionalString = z
  .string()
  .trim()
  .max(400)
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : undefined));

const countField = z.coerce
  .number({ invalid_type_error: 'Enter a number' })
  .int('Whole numbers only')
  .min(0, 'Cannot be negative')
  .max(100000, 'That looks too large')
  .default(0);

const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : undefined));

export const eventTypeEnum = z.enum(['PHYSICAL', 'ONLINE', 'HYBRID']);
export const orgTypeEnum = z.enum([
  'ROTARY_CLUB', 'ROTARACT_CLUB', 'NGO', 'SCHOOL', 'COLLEGE', 'UNIVERSITY',
  'CORPORATE', 'GOVERNMENT', 'COMMUNITY_ORG', 'OTHER',
]);
export const fundingEnum = z.enum([
  'CLUB_FUND', 'ROTARY_CLUB', 'SPONSOR', 'DONATION', 'MEMBER_CONTRIBUTION', 'PARTNER_ORGANIZATION', 'OTHER',
]);
export const beneficiaryEnum = z.enum([
  'CHILDREN', 'STUDENTS', 'WOMEN', 'MEN', 'SENIOR_CITIZENS', 'PATIENTS', 'FAMILIES', 'SCHOOL_STUDENTS',
  'COLLEGE_STUDENTS', 'DIFFERENTLY_ABLED', 'GENERAL_PUBLIC', 'COMMUNITY', 'ENVIRONMENT', 'ANIMALS',
  'ROTARACTORS', 'OTHER',
]);
export const socialEnum = z.enum(['INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'WEBSITE', 'OTHER']);
export const documentCategoryEnum = z.enum([
  'POSTER', 'ATTENDANCE_SHEET', 'BILL', 'INVOICE', 'PERMISSION_LETTER', 'APPRECIATION_LETTER',
  'CERTIFICATE', 'NEWSPAPER_COVERAGE', 'SOCIAL_MEDIA_SCREENSHOT', 'GENERATED_REPORT', 'OTHER',
]);

/** A draft can be almost empty — we only insist on a name to file it under. */
export const eventDraftSchema = z.object({
  eventName: z.string().trim().min(3, 'Give the event a name (at least 3 characters)').max(180),
  eventDate: z.coerce.date({ invalid_type_error: 'Pick a date' }).optional(),
  startTime: timeField,
  endTime: timeField,
  eventType: eventTypeEnum.default('PHYSICAL'),
  avenueId: z.string().min(1).optional(),

  chairId: z.string().optional(),
  chairNameText: optionalString,
  secretaryId: z.string().optional(),
  directorId: z.string().optional(),

  venue: optionalString,
  address: optionalString,
  city: optionalString,
  district: optionalString,
  state: optionalString,
  country: optionalString,
  platform: optionalString,
  meetingLink: z.string().url('Enter a valid link').optional().or(z.literal('')).transform((v) => (v ? v : undefined)),

  isCollaboration: z.boolean().default(false),
  projectWith: z.string().trim().max(180).default('SELF'),
  collaborators: z
    .array(
      z.object({
        orgType: orgTypeEnum.default('OTHER'),
        orgName: z.string().trim().min(2, 'Organisation name is required'),
        contactName: optionalString,
        contactEmail: z.string().email('Enter a valid email').optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
        contactPhone: optionalString,
      }),
    )
    .default([]),

  rotaractorsPresent: countField,
  rotariansPresent: countField,
  councilPresent: countField,
  guestsPresent: countField,

  beneficiaryCategories: z.array(beneficiaryEnum).default([]),
  directBeneficiaries: countField,
  indirectBeneficiaries: countField,
  beneficiaryNotes: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),

  hasExpenses: z.boolean().default(false),
  eventCost: z.coerce.number().min(0, 'Cost cannot be negative').max(100000000).default(0),
  fundingSource: fundingEnum.optional(),
  sponsorName: optionalString,
  expenseNotes: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),

  rawDescription: z.string().trim().max(8000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  description: z.string().trim().max(8000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  objective: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  accomplished: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  impact: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  specialOutcome: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),
  feedback: z.string().trim().max(2000).optional().or(z.literal('')).transform((v) => (v ? v : undefined)),

  isPartOfProject: z.boolean().default(false),
  projectId: z.string().optional(),
  projectName: optionalString,
  phaseNumber: z.coerce.number().int().min(1).max(200).optional(),

  socialLinks: z
    .array(z.object({ platform: socialEnum, url: z.string().url('Enter a valid URL') }))
    .default([]),
});

export type EventDraftInput = z.input<typeof eventDraftSchema>;
export type EventDraftValues = z.output<typeof eventDraftSchema>;

/** Cross-field rules that apply on submit (§39). */
export const eventSubmitSchema = eventDraftSchema
  .extend({
    eventDate: z.coerce.date({ required_error: 'Event date is required' }),
    avenueId: z.string().min(1, 'Pick an avenue of service'),
  })
  .superRefine((val, ctx) => {
    if (val.startTime && val.endTime && val.endTime < val.startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time cannot be before start time',
      });
    }
    if (val.isCollaboration && val.collaborators.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['collaborators'],
        message: 'Add the organisation you worked with',
      });
    }
    if (val.hasExpenses && !val.fundingSource) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fundingSource'], message: 'Where did the funds come from?' });
    }
    if (val.isPartOfProject && !val.projectId && !val.projectName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['projectName'], message: 'Name the larger project' });
    }
  });

export const reviewActionSchema = z.object({
  decision: z.enum(['APPROVED', 'CORRECTION_REQUESTED', 'REJECTED', 'COMMENT', 'START_REVIEW']),
  note: z.string().trim().max(4000).optional(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(2, 'Write a comment').max(4000),
  isInternal: z.boolean().default(false),
});

export const clubSettingsSchema = z.object({
  clubName: z.string().trim().min(2).max(160),
  rotarySponsor: z.string().trim().max(160).default(''),
  clubId: z.string().trim().max(40).default(''),
  groupName: z.string().trim().max(40).default(''),
  riDistrict: z.string().trim().max(40).default(''),
  presidentName: z.string().trim().max(120).default(''),
  secretaryName: z.string().trim().max(120).default(''),
  currentYear: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Use the form 2026-27'),
  currency: z.string().trim().length(3).default('INR'),
  minPhotos: z.coerce.number().int().min(0).max(50),
  maxPhotos: z.coerce.number().int().min(1).max(200),
  reportingDeadlineHrs: z.coerce.number().int().min(1).max(720),
  requiredFields: z.array(z.string()).default([]),
  driveRootFolderId: z.string().trim().max(120).optional().or(z.literal('')),
  aiEnabled: z.boolean().default(true),
  reportSections: z.record(z.boolean()).optional(),
});

export const memberSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().email('Enter a valid email'),
  phone: z.string().trim().max(24).optional().or(z.literal('')),
  role: z.enum([
    'SUPER_ADMIN', 'PRESIDENT', 'SECRETARY_ADMIN', 'SECRETARY_COMMUNICATION',
    'DIRECTOR', 'BOARD_MEMBER', 'REVIEWER', 'VIEWER',
  ]),
  boardPositionId: z.string().min(1, 'Designation is required'),
  avenueId: z.string().optional().or(z.literal('')),
  rotaractId: z.string().trim().max(40).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
  password: z.string().min(8, 'At least 8 characters').max(72).optional().or(z.literal('')),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export const eventSearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().optional(),
  avenueId: z.string().optional(),
  chairId: z.string().optional(),
  projectId: z.string().optional(),
  month: z.string().optional(), // "2026-01"
  year: z.string().optional(), // "2026-27"
  from: z.string().optional(),
  to: z.string().optional(),
  beneficiary: z.string().optional(),
  partner: z.string().optional(),
  mine: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(200).default(25),
  sort: z.string().optional(),
});

export function flattenZodError(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
