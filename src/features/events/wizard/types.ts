import type { EventWithRelations } from '@/server/events';

export type Collaborator = {
  orgType: string;
  orgName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type SocialLink = { platform: string; url: string };

/**
 * Everything the wizard holds. Inputs stay as strings so partially typed values
 * never get lost; Zod coerces on save.
 */
export type WizardValues = {
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  eventType: 'PHYSICAL' | 'ONLINE' | 'HYBRID';
  avenueId: string;

  chairId: string;
  chairNameText: string;
  secretaryId: string;
  directorId: string;

  venue: string;
  address: string;
  city: string;
  district: string;
  state: string;
  country: string;
  platform: string;
  meetingLink: string;

  isCollaboration: boolean;
  projectWith: string;
  collaborators: Collaborator[];

  rotaractorsPresent: string;
  rotariansPresent: string;
  councilPresent: string;
  guestsPresent: string;

  beneficiaryCategories: string[];
  directBeneficiaries: string;
  indirectBeneficiaries: string;
  beneficiaryNotes: string;

  hasExpenses: boolean;
  eventCost: string;
  fundingSource: string;
  sponsorName: string;
  expenseNotes: string;

  rawDescription: string;
  description: string;
  objective: string;
  accomplished: string;
  impact: string;
  specialOutcome: string;
  feedback: string;

  isPartOfProject: boolean;
  projectId: string;
  projectName: string;
  phaseNumber: string;

  socialLinks: SocialLink[];
};

export const emptyCollaborator: Collaborator = {
  orgType: 'NGO',
  orgName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
};

export function defaultValues(partial?: Partial<WizardValues>): WizardValues {
  return {
    eventName: '',
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: '',
    endTime: '',
    eventType: 'PHYSICAL',
    avenueId: '',
    chairId: '',
    chairNameText: '',
    secretaryId: '',
    directorId: '',
    venue: '',
    address: '',
    city: '',
    district: '',
    state: '',
    country: 'India',
    platform: '',
    meetingLink: '',
    isCollaboration: false,
    projectWith: 'SELF',
    collaborators: [],
    rotaractorsPresent: '0',
    rotariansPresent: '0',
    councilPresent: '0',
    guestsPresent: '0',
    beneficiaryCategories: [],
    directBeneficiaries: '0',
    indirectBeneficiaries: '0',
    beneficiaryNotes: '',
    hasExpenses: false,
    eventCost: '0',
    fundingSource: '',
    sponsorName: '',
    expenseNotes: '',
    rawDescription: '',
    description: '',
    objective: '',
    accomplished: '',
    impact: '',
    specialOutcome: '',
    feedback: '',
    isPartOfProject: false,
    projectId: '',
    projectName: '',
    phaseNumber: '',
    socialLinks: [],
    ...partial,
  };
}

export function valuesFromEvent(event: EventWithRelations): WizardValues {
  return defaultValues({
    eventName: event.eventName,
    eventDate: event.eventDate.toISOString().slice(0, 10),
    startTime: event.startTime ?? '',
    endTime: event.endTime ?? '',
    eventType: event.eventType,
    avenueId: event.avenueId,
    chairId: event.chairId ?? '',
    chairNameText: event.chairNameText ?? '',
    secretaryId: event.secretaryId ?? '',
    directorId: event.directorId ?? '',
    venue: event.venue ?? '',
    address: event.address ?? '',
    city: event.city ?? '',
    district: event.district ?? '',
    state: event.state ?? '',
    country: event.country ?? 'India',
    platform: event.platform ?? '',
    meetingLink: event.meetingLink ?? '',
    isCollaboration: event.isCollaboration,
    projectWith: event.projectWith,
    collaborators: event.collaborators.map((c) => ({
      orgType: c.orgType,
      orgName: c.orgName,
      contactName: c.contactName ?? '',
      contactEmail: c.contactEmail ?? '',
      contactPhone: c.contactPhone ?? '',
    })),
    rotaractorsPresent: String(event.rotaractorsPresent),
    rotariansPresent: String(event.rotariansPresent),
    councilPresent: String(event.councilPresent),
    guestsPresent: String(event.guestsPresent),
    beneficiaryCategories: event.beneficiaries.map((b) => b.category),
    directBeneficiaries: String(event.directBeneficiaries),
    indirectBeneficiaries: String(event.indirectBeneficiaries),
    beneficiaryNotes: event.beneficiaryNotes ?? '',
    hasExpenses: event.hasExpenses,
    eventCost: String(Number(event.eventCost)),
    fundingSource: event.fundingSource ?? '',
    sponsorName: event.sponsorName ?? '',
    expenseNotes: event.expenseNotes ?? '',
    rawDescription: event.rawDescription ?? '',
    description: event.description ?? '',
    objective: event.objective ?? '',
    accomplished: event.accomplished ?? '',
    impact: event.impact ?? '',
    specialOutcome: event.specialOutcome ?? '',
    feedback: event.feedback ?? '',
    isPartOfProject: Boolean(event.projectId || event.projectName),
    projectId: event.projectId ?? '',
    projectName: event.projectName ?? '',
    phaseNumber: event.phaseNumber ? String(event.phaseNumber) : '',
    socialLinks: event.socialLinks.map((s) => ({ platform: s.platform, url: s.url })),
  });
}

/** Shape sent to the server actions (Zod coerces the numeric strings). */
export function toPayload(values: WizardValues) {
  return {
    ...values,
    eventDate: values.eventDate ? new Date(values.eventDate) : undefined,
    rotaractorsPresent: Number(values.rotaractorsPresent || 0),
    rotariansPresent: Number(values.rotariansPresent || 0),
    councilPresent: Number(values.councilPresent || 0),
    guestsPresent: Number(values.guestsPresent || 0),
    directBeneficiaries: Number(values.directBeneficiaries || 0),
    indirectBeneficiaries: Number(values.indirectBeneficiaries || 0),
    eventCost: Number(values.eventCost || 0),
    phaseNumber: values.phaseNumber ? Number(values.phaseNumber) : undefined,
    fundingSource: values.fundingSource || undefined,
    projectId: values.projectId || undefined,
    collaborators: values.isCollaboration ? values.collaborators.filter((c) => c.orgName.trim()) : [],
    socialLinks: values.socialLinks.filter((s) => s.url.trim()),
  };
}

export type WizardOption = { value: string; label: string };

export type WizardContextData = {
  avenues: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; name: string; role: string; position?: string | null }>;
  projects: Array<{ id: string; name: string }>;
  settings: { minPhotos: number; maxPhotos: number; currency: string; requiredFields: string[]; aiEnabled: boolean };
  aiAvailable: boolean;
};
