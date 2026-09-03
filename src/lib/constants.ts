import type {
  BeneficiaryCategory,
  DocumentCategory,
  EventStatus,
  EventType,
  FundingSource,
  OrgType,
  Role,
  SocialPlatform,
} from '@/generated/prisma/enums';

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  PRESIDENT: 'President',
  SECRETARY: 'Secretary',
  DIRECTOR: 'Director',
  BOARD_MEMBER: 'Board Member',
  VIEWER: 'Member / Viewer',
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  CORRECTION_REQUIRED: 'Correction required',
  APPROVED: 'Approved',
  ARCHIVED: 'Archived',
};

/** Tailwind classes per status badge — one place, used everywhere. */
export const STATUS_STYLES: Record<EventStatus, string> = {
  DRAFT: 'bg-ink-100 text-ink-700 ring-ink-200',
  SUBMITTED: 'bg-azure-50 text-azure-700 ring-azure-100',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  CORRECTION_REQUIRED: 'bg-orange-50 text-orange-700 ring-orange-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ARCHIVED: 'bg-ink-100 text-ink-500 ring-ink-200',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PHYSICAL: 'Physical',
  ONLINE: 'Online',
  HYBRID: 'Hybrid',
};

export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  ROTARY_CLUB: 'Rotary Club',
  ROTARACT_CLUB: 'Rotaract Club',
  NGO: 'NGO',
  SCHOOL: 'School',
  COLLEGE: 'College',
  UNIVERSITY: 'University',
  CORPORATE: 'Corporate',
  GOVERNMENT: 'Government',
  COMMUNITY_ORG: 'Community Organization',
  OTHER: 'Other',
};

export const FUNDING_LABELS: Record<FundingSource, string> = {
  CLUB_FUND: 'Club Fund',
  ROTARY_CLUB: 'Rotary Club',
  SPONSOR: 'Sponsor',
  DONATION: 'Donation',
  MEMBER_CONTRIBUTION: 'Member Contribution',
  PARTNER_ORGANIZATION: 'Partner Organization',
  OTHER: 'Other',
};

export const BENEFICIARY_LABELS: Record<BeneficiaryCategory, string> = {
  CHILDREN: 'Children',
  STUDENTS: 'Students',
  WOMEN: 'Women',
  MEN: 'Men',
  SENIOR_CITIZENS: 'Senior Citizens',
  PATIENTS: 'Patients',
  FAMILIES: 'Families',
  SCHOOL_STUDENTS: 'School Students',
  COLLEGE_STUDENTS: 'College Students',
  DIFFERENTLY_ABLED: 'Differently Abled',
  GENERAL_PUBLIC: 'General Public',
  COMMUNITY: 'Community',
  ENVIRONMENT: 'Environment',
  ANIMALS: 'Animals',
  ROTARACTORS: 'Rotaractors',
  OTHER: 'Other',
};

export const DOCUMENT_LABELS: Record<DocumentCategory, string> = {
  POSTER: 'Event Poster',
  ATTENDANCE_SHEET: 'Attendance Sheet',
  BILL: 'Bill',
  INVOICE: 'Invoice',
  PERMISSION_LETTER: 'Permission Letter',
  APPRECIATION_LETTER: 'Appreciation Letter',
  CERTIFICATE: 'Certificate',
  NEWSPAPER_COVERAGE: 'Newspaper Coverage',
  SOCIAL_MEDIA_SCREENSHOT: 'Social Media Screenshot',
  GENERATED_REPORT: 'Generated Report',
  OTHER: 'Other Document',
};

/** Which Drive subfolder each document category is filed into (§14). */
export const DOCUMENT_DRIVE_BUCKET: Record<DocumentCategory, 'poster' | 'documents' | 'financials' | 'social' | 'report'> = {
  POSTER: 'poster',
  ATTENDANCE_SHEET: 'documents',
  BILL: 'financials',
  INVOICE: 'financials',
  PERMISSION_LETTER: 'documents',
  APPRECIATION_LETTER: 'documents',
  CERTIFICATE: 'documents',
  NEWSPAPER_COVERAGE: 'documents',
  SOCIAL_MEDIA_SCREENSHOT: 'social',
  GENERATED_REPORT: 'report',
  OTHER: 'documents',
};

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  LINKEDIN: 'LinkedIn',
  YOUTUBE: 'YouTube',
  WEBSITE: 'Website',
  OTHER: 'Other',
};

export const DEFAULT_AVENUES = [
  { name: 'Community Service', slug: 'community-service', color: '#cd2a63' },
  { name: 'Club Service', slug: 'club-service', color: '#1f7ae0' },
  { name: 'Professional Development', slug: 'professional-development', color: '#7c3aed' },
  { name: 'International Service', slug: 'international-service', color: '#0d9488' },
  { name: 'Fellowship', slug: 'fellowship', color: '#f59e0b' },
  { name: 'Sports', slug: 'sports', color: '#16a34a' },
  { name: 'Public Image', slug: 'public-image', color: '#e11d48' },
  { name: 'Other', slug: 'other', color: '#64748b' },
];

export const DEFAULT_BOARD_POSITIONS = [
  'President',
  'Secretary — Administration',
  'Secretary — Communication',
  'Treasurer',
  'Sergeant-at-Arms',
  'Director — Community Service',
  'Director — Club Service',
  'Director — Professional Development',
  'Director — International Service',
  'Director — Public Image',
  'Editor',
  'Member',
];

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const WIZARD_STEPS = [
  { key: 'basics', title: 'Basic details', short: 'Basics' },
  { key: 'leadership', title: 'Leadership', short: 'Leadership' },
  { key: 'venue', title: 'Venue', short: 'Venue' },
  { key: 'collaboration', title: 'Collaboration', short: 'Partner' },
  { key: 'participation', title: 'Participation', short: 'People' },
  { key: 'beneficiaries', title: 'Beneficiaries', short: 'Impact group' },
  { key: 'financials', title: 'Financials', short: 'Cost' },
  { key: 'description', title: 'What happened', short: 'Story' },
  { key: 'impact', title: 'Outcome', short: 'Outcome' },
  { key: 'photos', title: 'Photos', short: 'Photos' },
  { key: 'evidence', title: 'Other evidence', short: 'Evidence' },
  { key: 'social', title: 'Social media', short: 'Social' },
  { key: 'review', title: 'Review & submit', short: 'Review' },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];
