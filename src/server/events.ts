import { prisma } from '@/lib/prisma';
import { eventIdFor } from '@/lib/naming';
import { computeCompleteness, type CompletenessInput } from '@/lib/completeness';
import { getClubSettings } from '@/server/settings';
import type { EventDraftValues } from '@/lib/validation';
import type { EventStatus, Prisma } from '@/generated/prisma/client';

/**
 * Event persistence. Derived values (totals, completeness) are computed here so
 * that every entry point — wizard, API, seed — stores the same numbers.
 */

export async function nextEventId(eventDate: Date): Promise<string> {
  const year = eventDate.getFullYear();
  const prefix = `EVT-${year}-`;
  const last = await prisma.event.findFirst({
    where: { eventId: { startsWith: prefix } },
    orderBy: { eventId: 'desc' },
    select: { eventId: true },
  });
  const lastSeq = last ? Number(last.eventId.slice(prefix.length)) : 0;
  return eventIdFor(year, (Number.isFinite(lastSeq) ? lastSeq : 0) + 1);
}

export const eventInclude = {
  avenue: true,
  chair: { select: { id: true, name: true, image: true, email: true } },
  secretary: { select: { id: true, name: true, image: true } },
  director: { select: { id: true, name: true, image: true } },
  createdBy: { select: { id: true, name: true, image: true, email: true } },
  project: true,
  beneficiaries: true,
  collaborators: true,
  photos: { orderBy: { sortOrder: 'asc' } },
  documents: { orderBy: { uploadedAt: 'asc' } },
  socialLinks: true,
  driveFolder: true,
  reports: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.EventInclude;

export type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export function totalsFor(values: {
  rotaractorsPresent?: number;
  rotariansPresent?: number;
  councilPresent?: number;
  guestsPresent?: number;
  directBeneficiaries?: number;
  indirectBeneficiaries?: number;
}) {
  return {
    totalParticipants:
      (values.rotaractorsPresent ?? 0) +
      (values.rotariansPresent ?? 0) +
      (values.councilPresent ?? 0) +
      (values.guestsPresent ?? 0),
    totalBeneficiaries: (values.directBeneficiaries ?? 0) + (values.indirectBeneficiaries ?? 0),
  };
}

export async function completenessFor(eventId: string) {
  const settings = await getClubSettings();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      beneficiaries: true,
      collaborators: true,
      photos: true,
      documents: true,
      socialLinks: true,
    },
  });
  if (!event) return null;

  const input: CompletenessInput = {
    ...event,
    eventCost: Number(event.eventCost),
    beneficiaryCount: event.beneficiaries.length,
    collaboratorCount: event.collaborators.length,
    photoCount: event.photos.length,
    posterCount: event.documents.filter((d) => d.category === 'POSTER').length,
    documentCount: event.documents.filter((d) => d.category !== 'POSTER').length,
    socialLinkCount: event.socialLinks.length,
  };

  return computeCompleteness(input, { minPhotos: settings.minPhotos, requiredFields: settings.requiredFields });
}

export async function refreshCompleteness(eventId: string) {
  const result = await completenessFor(eventId);
  if (!result) return null;
  await prisma.event.update({ where: { id: eventId }, data: { completeness: result.score } });
  return result;
}

type WritePayload = Partial<EventDraftValues>;

function scalarData(values: WritePayload) {
  const totals = totalsFor({
    rotaractorsPresent: values.rotaractorsPresent,
    rotariansPresent: values.rotariansPresent,
    councilPresent: values.councilPresent,
    guestsPresent: values.guestsPresent,
    directBeneficiaries: values.directBeneficiaries,
    indirectBeneficiaries: values.indirectBeneficiaries,
  });

  const data: Prisma.EventUncheckedUpdateInput = {};
  const assign = <K extends keyof Prisma.EventUncheckedUpdateInput>(key: K, value: unknown) => {
    if (value !== undefined) data[key] = value as never;
  };

  assign('eventName', values.eventName);
  assign('eventDate', values.eventDate);
  assign('startTime', values.startTime ?? null);
  assign('endTime', values.endTime ?? null);
  assign('eventType', values.eventType);
  assign('avenueId', values.avenueId);
  assign('chairId', values.chairId || null);
  assign('chairNameText', values.chairNameText ?? null);
  assign('secretaryId', values.secretaryId || null);
  assign('directorId', values.directorId || null);
  assign('venue', values.venue ?? null);
  assign('address', values.address ?? null);
  assign('city', values.city ?? null);
  assign('district', values.district ?? null);
  assign('state', values.state ?? null);
  assign('country', values.country ?? null);
  assign('platform', values.platform ?? null);
  assign('meetingLink', values.meetingLink ?? null);
  assign('isCollaboration', values.isCollaboration);
  assign('projectWith', values.isCollaboration === false ? 'SELF' : values.projectWith);
  assign('rotaractorsPresent', values.rotaractorsPresent);
  assign('rotariansPresent', values.rotariansPresent);
  assign('councilPresent', values.councilPresent);
  assign('guestsPresent', values.guestsPresent);
  assign('directBeneficiaries', values.directBeneficiaries);
  assign('indirectBeneficiaries', values.indirectBeneficiaries);
  assign('beneficiaryNotes', values.beneficiaryNotes ?? null);
  assign('hasExpenses', values.hasExpenses);
  assign('eventCost', values.hasExpenses === false ? 0 : values.eventCost);
  assign('fundingSource', values.hasExpenses === false ? null : (values.fundingSource ?? null));
  assign('sponsorName', values.sponsorName ?? null);
  assign('expenseNotes', values.expenseNotes ?? null);
  assign('rawDescription', values.rawDescription ?? null);
  assign('description', values.description ?? null);
  assign('objective', values.objective ?? null);
  assign('accomplished', values.accomplished ?? null);
  assign('impact', values.impact ?? null);
  assign('specialOutcome', values.specialOutcome ?? null);
  assign('feedback', values.feedback ?? null);
  assign('projectId', values.isPartOfProject === false ? null : values.projectId || null);
  assign('projectName', values.isPartOfProject === false ? null : (values.projectName ?? null));
  assign('phaseNumber', values.isPartOfProject === false ? null : (values.phaseNumber ?? null));

  if (
    values.rotaractorsPresent !== undefined ||
    values.rotariansPresent !== undefined ||
    values.councilPresent !== undefined ||
    values.guestsPresent !== undefined
  ) {
    data.totalParticipants = totals.totalParticipants;
  }
  if (values.directBeneficiaries !== undefined || values.indirectBeneficiaries !== undefined) {
    data.totalBeneficiaries = totals.totalBeneficiaries;
  }
  return data;
}

export async function createEventDraft(values: EventDraftValues, userId: string) {
  const settings = await getClubSettings();
  const eventDate = values.eventDate ?? new Date();
  const eventId = await nextEventId(eventDate);
  const totals = totalsFor(values);

  const avenueId =
    values.avenueId ??
    (await prisma.avenue.findFirst({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }))?.id;
  if (!avenueId) throw new Error('No avenues configured. An admin must add at least one avenue of service.');

  const event = await prisma.event.create({
    data: {
      eventId,
      eventName: values.eventName,
      eventDate,
      startTime: values.startTime,
      endTime: values.endTime,
      eventType: values.eventType,
      avenueId,
      chairId: values.chairId || null,
      chairNameText: values.chairNameText,
      secretaryId: values.secretaryId || null,
      directorId: values.directorId || null,
      venue: values.venue,
      address: values.address,
      city: values.city,
      district: values.district,
      state: values.state,
      country: values.country ?? 'India',
      platform: values.platform,
      meetingLink: values.meetingLink,
      isCollaboration: values.isCollaboration,
      projectWith: values.isCollaboration ? values.projectWith : 'SELF',
      rotaractorsPresent: values.rotaractorsPresent,
      rotariansPresent: values.rotariansPresent,
      councilPresent: values.councilPresent,
      guestsPresent: values.guestsPresent,
      totalParticipants: totals.totalParticipants,
      directBeneficiaries: values.directBeneficiaries,
      indirectBeneficiaries: values.indirectBeneficiaries,
      totalBeneficiaries: totals.totalBeneficiaries,
      beneficiaryNotes: values.beneficiaryNotes,
      hasExpenses: values.hasExpenses,
      eventCost: values.hasExpenses ? values.eventCost : 0,
      currency: settings.currency,
      fundingSource: values.hasExpenses ? values.fundingSource : null,
      sponsorName: values.sponsorName,
      expenseNotes: values.expenseNotes,
      rawDescription: values.rawDescription,
      description: values.description,
      objective: values.objective,
      accomplished: values.accomplished,
      impact: values.impact,
      specialOutcome: values.specialOutcome,
      feedback: values.feedback,
      projectId: values.isPartOfProject ? values.projectId || null : null,
      projectName: values.isPartOfProject ? values.projectName : null,
      phaseNumber: values.isPartOfProject ? values.phaseNumber : null,
      status: 'DRAFT',
      createdById: userId,
      beneficiaries: {
        create: values.beneficiaryCategories.map((category) => ({ category })),
      },
      collaborators: {
        create: values.isCollaboration ? values.collaborators : [],
      },
      socialLinks: { create: values.socialLinks },
      statusHistory: { create: { to: 'DRAFT', actorId: userId, note: 'Draft created' } },
    },
  });

  await refreshCompleteness(event.id);
  return event;
}

export async function updateEventDraft(eventId: string, values: WritePayload) {
  await prisma.$transaction(async (tx) => {
    await tx.event.update({ where: { id: eventId }, data: scalarData(values) });

    if (values.beneficiaryCategories) {
      await tx.eventBeneficiary.deleteMany({ where: { eventId } });
      if (values.beneficiaryCategories.length) {
        await tx.eventBeneficiary.createMany({
          data: values.beneficiaryCategories.map((category) => ({ eventId, category })),
          skipDuplicates: true,
        });
      }
    }
    if (values.collaborators) {
      await tx.eventCollaborator.deleteMany({ where: { eventId } });
      if (values.isCollaboration !== false && values.collaborators.length) {
        await tx.eventCollaborator.createMany({
          data: values.collaborators.map((c) => ({ ...c, eventId })),
        });
      }
    }
    if (values.socialLinks) {
      await tx.eventSocialLink.deleteMany({ where: { eventId } });
      if (values.socialLinks.length) {
        await tx.eventSocialLink.createMany({ data: values.socialLinks.map((s) => ({ ...s, eventId })) });
      }
    }
  });

  return refreshCompleteness(eventId);
}

export async function recordStatus(params: {
  eventId: string;
  from?: EventStatus | null;
  to: EventStatus;
  actorId?: string | null;
  note?: string;
}) {
  await prisma.eventStatusHistory.create({
    data: {
      eventId: params.eventId,
      from: params.from ?? null,
      to: params.to,
      actorId: params.actorId ?? null,
      note: params.note,
    },
  });
}

/** Overdue = event happened more than N hours ago and is still not submitted (§26). */
export function overdueCutoff(deadlineHours: number) {
  return new Date(Date.now() - deadlineHours * 60 * 60 * 1000);
}

export async function overdueEvents(deadlineHours: number) {
  return prisma.event.findMany({
    where: {
      deletedAt: null,
      status: { in: ['DRAFT', 'CORRECTION_REQUIRED'] },
      eventDate: { lt: overdueCutoff(deadlineHours) },
    },
    include: { avenue: true, createdBy: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { eventDate: 'asc' },
  });
}
