'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/session';
import { logAudit } from '@/server/audit';
import { notify, reviewerIds } from '@/server/notifications';
import { getClubSettings } from '@/server/settings';
import {
  canApproveEvent,
  canDeleteEvent,
  canEditEvent,
  canReviewEvent,
  canSubmitEvent,
  can,
} from '@/lib/permissions';
import {
  completenessFor,
  createEventDraft,
  recordStatus,
  refreshCompleteness,
  updateEventDraft,
} from '@/server/events';
import { syncEventInBackground } from '@/server/drive/service';
import { commentSchema, eventDraftSchema, eventSubmitSchema, flattenZodError, reviewActionSchema } from '@/lib/validation';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

async function loadEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.deletedAt) return null;
  return event;
}

export async function createEventAction(raw: unknown): Promise<ActionResult<{ id: string; eventId: string }>> {
  const user = await requireUser();
  if (!can(user, 'event.create')) return { ok: false, message: 'You cannot create events.' };

  const parsed = eventDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: flattenZodError(parsed.error) };
  }

  const event = await createEventDraft(parsed.data, user.id);
  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: 'event.create',
    entityType: 'event',
    entityId: event.id,
    summary: `${user.name} created report ${event.eventId} — ${event.eventName}`,
  });
  revalidatePath('/dashboard');
  revalidatePath('/my-events');
  return { ok: true, data: { id: event.id, eventId: event.eventId }, message: 'Draft saved.' };
}

export async function saveEventAction(id: string, raw: unknown): Promise<ActionResult<{ completeness: number }>> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };
  if (!canEditEvent(user, event)) return { ok: false, message: 'This report is locked for editing.' };

  const parsed = eventDraftSchema.partial().safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: flattenZodError(parsed.error) };
  }

  const result = await updateEventDraft(id, parsed.data);
  revalidatePath(`/events/${id}`);
  return { ok: true, data: { completeness: result?.score ?? event.completeness }, message: 'Draft saved.' };
}

export async function submitEventAction(id: string): Promise<ActionResult<{ status: string; drive: string }>> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };
  if (!canSubmitEvent(user, event)) return { ok: false, message: 'You cannot submit this report.' };

  const full = await prisma.event.findUniqueOrThrow({
    where: { id },
    include: { beneficiaries: true, collaborators: true, socialLinks: true },
  });

  const parsed = eventSubmitSchema.safeParse({
    ...full,
    eventCost: Number(full.eventCost),
    startTime: full.startTime ?? '',
    endTime: full.endTime ?? '',
    chairId: full.chairId ?? undefined,
    fundingSource: full.fundingSource ?? undefined,
    beneficiaryCategories: full.beneficiaries.map((b) => b.category),
    collaborators: full.collaborators.map((c) => ({
      orgType: c.orgType,
      orgName: c.orgName,
      contactName: c.contactName ?? '',
      contactEmail: c.contactEmail ?? '',
      contactPhone: c.contactPhone ?? '',
    })),
    socialLinks: full.socialLinks.map((s) => ({ platform: s.platform, url: s.url })),
    isPartOfProject: Boolean(full.projectId || full.projectName),
    projectId: full.projectId ?? undefined,
    projectName: full.projectName ?? undefined,
    phaseNumber: full.phaseNumber ?? undefined,
    meetingLink: full.meetingLink ?? '',
  });
  if (!parsed.success) {
    return { ok: false, message: 'Some required details are missing.', fieldErrors: flattenZodError(parsed.error) };
  }

  const completeness = await completenessFor(id);
  if (completeness && !completeness.canSubmit) {
    return {
      ok: false,
      message: completeness.summary,
      fieldErrors: Object.fromEntries(completeness.missingRequired.map((c) => [c.key, `${c.label} is required`])),
    };
  }

  const isResubmission = event.status === 'CORRECTION_REQUIRED';
  await prisma.event.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date(), completeness: completeness?.score ?? event.completeness },
  });
  await recordStatus({
    eventId: id,
    from: event.status,
    to: 'SUBMITTED',
    actorId: user.id,
    note: isResubmission ? 'Resubmitted after corrections' : 'Submitted for review',
  });
  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: isResubmission ? 'event.resubmit' : 'event.submit',
    entityType: 'event',
    entityId: id,
    summary: `${user.name} ${isResubmission ? 'resubmitted' : 'submitted'} ${event.eventId}`,
  });

  await notify({
    userIds: await reviewerIds(event.avenueId),
    type: isResubmission ? 'EVENT_RESUBMITTED' : 'EVENT_SUBMITTED',
    title: `${event.eventId} — ${event.eventName} ${isResubmission ? 'resubmitted' : 'submitted'}`,
    body: `${user.name} sent this report for review.`,
    link: `/events/${id}`,
  });
  await notify({
    userIds: [event.createdById],
    type: 'GENERIC',
    title: 'Report submitted successfully',
    body: `${event.eventId} — ${event.eventName} is now with the review team.`,
    link: `/events/${id}`,
  });

  // Drive work happens after the user already has their confirmation (§36).
  syncEventInBackground(id);

  revalidatePath('/dashboard');
  revalidatePath('/my-events');
  revalidatePath('/reviews');
  revalidatePath(`/events/${id}`);
  return {
    ok: true,
    data: { status: 'SUBMITTED', drive: 'queued' },
    message: 'Report submitted successfully.',
  };
}

export async function reviewEventAction(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };

  const parsed = reviewActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Choose an action first.' };
  const { decision, note } = parsed.data;

  if (!canReviewEvent(user, event)) {
    return {
      ok: false,
      message:
        event.createdById === user.id || event.chairId === user.id
          ? 'You cannot review your own event — ask another board officer.'
          : 'You do not have review access to this report.',
    };
  }
  if (decision === 'APPROVED' && !canApproveEvent(user, event)) {
    return { ok: false, message: 'Your role can review but not approve.' };
  }
  if ((decision === 'CORRECTION_REQUESTED' || decision === 'REJECTED') && !note?.trim()) {
    return { ok: false, message: 'Tell the board member what needs fixing.', fieldErrors: { note: 'A note is required' } };
  }

  const nextStatus =
    decision === 'START_REVIEW'
      ? 'UNDER_REVIEW'
      : decision === 'APPROVED'
        ? 'APPROVED'
        : decision === 'CORRECTION_REQUESTED' || decision === 'REJECTED'
          ? 'CORRECTION_REQUIRED'
          : event.status;

  await prisma.$transaction(async (tx) => {
    if (decision !== 'START_REVIEW') {
      await tx.eventReview.create({
        data: {
          eventId: id,
          reviewerId: user.id,
          decision,
          note,
        },
      });
    }
    if (note?.trim()) {
      await tx.eventComment.create({ data: { eventId: id, authorId: user.id, body: note.trim() } });
    }
    if (nextStatus !== event.status) {
      await tx.event.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedAt: decision === 'APPROVED' ? new Date() : null,
          approvedById: decision === 'APPROVED' ? user.id : null,
          lockedForEdits: decision === 'APPROVED',
        },
      });
    }
  });

  if (nextStatus !== event.status) {
    await recordStatus({ eventId: id, from: event.status, to: nextStatus, actorId: user.id, note });
  }

  const summaryVerb =
    decision === 'APPROVED'
      ? 'approved'
      : decision === 'CORRECTION_REQUESTED'
        ? 'requested corrections on'
        : decision === 'REJECTED'
          ? 'rejected'
          : decision === 'START_REVIEW'
            ? 'started reviewing'
            : 'commented on';

  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: `event.${decision.toLowerCase()}`,
    entityType: 'event',
    entityId: id,
    summary: `${user.name} ${summaryVerb} ${event.eventId}`,
    metadata: note ? { note } : undefined,
  });

  if (decision === 'APPROVED') {
    await notify({
      userIds: [event.createdById, event.chairId ?? ''].filter(Boolean),
      type: 'EVENT_APPROVED',
      title: `${event.eventName} has been approved`,
      body: `${user.name} approved ${event.eventId}. The report is now locked.`,
      link: `/events/${id}`,
    });
    syncEventInBackground(id);
  } else if (decision === 'CORRECTION_REQUESTED' || decision === 'REJECTED') {
    await notify({
      userIds: [event.createdById, event.chairId ?? ''].filter(Boolean),
      type: 'CORRECTION_REQUESTED',
      title: `${event.eventName} needs a correction`,
      body: note ?? 'A reviewer asked for changes.',
      link: `/events/${id}`,
    });
  }

  revalidatePath('/reviews');
  revalidatePath('/dashboard');
  revalidatePath(`/events/${id}`);
  return { ok: true, message: `Report ${summaryVerb}.` };
}

export async function commentAction(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };

  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Write a comment first.' };

  const mayComment =
    canReviewEvent(user, event) || event.createdById === user.id || event.chairId === user.id || can(user, 'event.viewAll');
  if (!mayComment) return { ok: false, message: 'You cannot comment on this report.' };

  await prisma.eventComment.create({
    data: { eventId: id, authorId: user.id, body: parsed.data.body, isInternal: parsed.data.isInternal },
  });
  await notify({
    userIds: [event.createdById, ...(await reviewerIds(event.avenueId))].filter((uid) => uid !== user.id),
    type: 'GENERIC',
    title: `New comment on ${event.eventId}`,
    body: parsed.data.body.slice(0, 140),
    link: `/events/${id}`,
  });
  revalidatePath(`/events/${id}`);
  return { ok: true, message: 'Comment added.' };
}

export async function unlockEventAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };
  if (!can(user, 'event.unlock')) return { ok: false, message: 'Only the President or an admin can unlock a report.' };

  await prisma.event.update({
    where: { id },
    data: { lockedForEdits: false, status: 'UNDER_REVIEW', approvedAt: null, approvedById: null },
  });
  await recordStatus({ eventId: id, from: event.status, to: 'UNDER_REVIEW', actorId: user.id, note: 'Unlocked for edits' });
  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: 'event.unlock',
    entityType: 'event',
    entityId: id,
    summary: `${user.name} unlocked ${event.eventId} for editing`,
  });
  revalidatePath(`/events/${id}`);
  return { ok: true, message: 'Report unlocked for editing.' };
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const event = await loadEvent(id);
  if (!event) return { ok: false, message: 'That event no longer exists.' };
  if (!canDeleteEvent(user, event)) return { ok: false, message: 'You cannot delete this report.' };
  if (event.status === 'APPROVED' && user.role !== 'SUPER_ADMIN') {
    return { ok: false, message: 'Approved reports can only be removed by a Super Admin.' };
  }

  await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: 'event.delete',
    entityType: 'event',
    entityId: id,
    summary: `${user.name} moved ${event.eventId} to the archive (soft delete)`,
  });
  revalidatePath('/events');
  revalidatePath('/my-events');
  return { ok: true, message: 'Report archived. A Super Admin can restore or permanently delete it.' };
}

export async function refreshCompletenessAction(id: string): Promise<ActionResult<{ score: number }>> {
  await requireUser();
  const result = await refreshCompleteness(id);
  return { ok: true, data: { score: result?.score ?? 0 } };
}

const reminderSchema = z.object({ eventIds: z.array(z.string()).min(1) });

export async function sendOverdueRemindersAction(raw: unknown): Promise<ActionResult<{ sent: number }>> {
  const user = await requireUser();
  if (!can(user, 'event.review')) return { ok: false, message: 'Only reviewers can send reminders.' };
  const parsed = reminderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Pick at least one overdue report.' };

  const settings = await getClubSettings();
  const events = await prisma.event.findMany({ where: { id: { in: parsed.data.eventIds } } });
  for (const event of events) {
    await notify({
      userIds: [event.createdById],
      type: 'REPORT_OVERDUE',
      title: `Your report for ${event.eventName} is overdue`,
      body: `Reports are due within ${settings.reportingDeadlineHrs} hours of the event.`,
      link: `/events/${event.id}/edit`,
    });
  }
  return { ok: true, data: { sent: events.length }, message: `Reminder sent for ${events.length} report(s).` };
}
