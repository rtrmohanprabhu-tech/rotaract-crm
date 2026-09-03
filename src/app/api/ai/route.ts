import { z } from 'zod';
import { apiError, ok, rateLimit } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { prisma } from '@/lib/prisma';
import { canEditEvent, can } from '@/lib/permissions';
import { getClubSettings } from '@/server/settings';
import {
  AiNotConfiguredError,
  aiEnabled,
  detectMissingInformation,
  improveDescription,
  suggestBeneficiaries,
  summariseEvent,
  summarisePeriod,
  type EventFacts,
} from '@/server/ai';
import { BENEFICIARY_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  task: z.enum(['improve_description', 'summarise_event', 'suggest_beneficiaries', 'detect_missing', 'summarise_period']),
  eventId: z.string().optional(),
  text: z.string().max(8000).optional(),
  periodKey: z.string().optional(),
});

async function factsFor(eventId: string): Promise<{ facts: EventFacts; description: string }> {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: { avenue: true, chair: true, beneficiaries: true, collaborators: true, project: true },
  });
  return {
    description: event.description ?? '',
    facts: {
      eventName: event.eventName,
      avenue: event.avenue.name,
      eventDate: formatDate(event.eventDate),
      venue: event.venue ?? event.platform ?? undefined,
      chair: event.chair?.name ?? event.chairNameText ?? undefined,
      projectWith: event.collaborators.map((c) => c.orgName).join(', ') || event.projectWith,
      participants: {
        rotaractors: event.rotaractorsPresent,
        rotarians: event.rotariansPresent,
        council: event.councilPresent,
        guests: event.guestsPresent,
        total: event.totalParticipants,
      },
      beneficiaries: event.beneficiaries.map((b) => BENEFICIARY_LABELS[b.category]),
      directBeneficiaries: event.directBeneficiaries,
      indirectBeneficiaries: event.indirectBeneficiaries,
      cost: Number(event.eventCost),
      currency: event.currency,
      objective: event.objective ?? undefined,
      accomplished: event.accomplished ?? undefined,
      impact: event.impact ?? undefined,
      projectName: event.project?.name ?? event.projectName ?? undefined,
      phaseNumber: event.phaseNumber ?? undefined,
    },
  };
}

export async function POST(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();

    const settings = await getClubSettings();
    if (!settings.aiEnabled) forbidden('AI assistance has been switched off for this club.');
    if (!aiEnabled()) throw new AiNotConfiguredError();

    const limit = rateLimit(`ai:${user.id}`, 20, 60_000);
    if (!limit.ok) forbidden(`Slow down a moment — try again in ${limit.retryAfter}s.`);

    const body = bodySchema.parse(await req.json());

    if (body.task === 'summarise_period') {
      if (!can(user, 'report.generate')) forbidden('Only the review team can generate summaries.');
      const key = body.periodKey ?? new Date().toISOString().slice(0, 7);
      const [y, m] = key.split('-').map(Number);
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to = new Date(Date.UTC(y, m, 1));
      const events = await prisma.event.findMany({
        where: { deletedAt: null, status: 'APPROVED', eventDate: { gte: from, lt: to } },
        include: { avenue: true },
      });
      const totals = events.reduce(
        (acc, e) => ({
          events: acc.events + 1,
          participants: acc.participants + e.totalParticipants,
          beneficiaries: acc.beneficiaries + e.totalBeneficiaries,
          cost: acc.cost + Number(e.eventCost),
          currency: settings.currency,
        }),
        { events: 0, participants: 0, beneficiaries: 0, cost: 0, currency: settings.currency },
      );
      const text = await summarisePeriod({
        label: key,
        totals,
        events: events.map((e) => ({ name: e.eventName, avenue: e.avenue.name, date: formatDate(e.eventDate), description: e.description })),
      });
      return ok({ text });
    }

    if (!body.eventId) return ok({ error: 'eventId is required.' }, { status: 400 });
    const event = await prisma.event.findUnique({ where: { id: body.eventId } });
    if (!event) return ok({ error: 'Event not found.' }, { status: 404 });
    if (!canEditEvent(user, event) && !can(user, 'event.review')) forbidden('You cannot use AI on this report.');

    const { facts, description } = await factsFor(body.eventId);

    switch (body.task) {
      case 'improve_description': {
        const text = await improveDescription(body.text ?? event.rawDescription ?? '', facts);
        return ok({ text });
      }
      case 'summarise_event': {
        const text = await summariseEvent(facts, body.text ?? description);
        return ok({ text });
      }
      case 'suggest_beneficiaries': {
        const categories = await suggestBeneficiaries(body.text ?? description, Object.keys(BENEFICIARY_LABELS));
        return ok({ categories });
      }
      case 'detect_missing': {
        const questions = await detectMissingInformation(facts, body.text ?? description);
        return ok({ questions });
      }
      default:
        return ok({ error: 'Unknown task.' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return ok({ error: error.message, configured: false }, { status: 503 });
    }
    return apiError(error);
  }
}
