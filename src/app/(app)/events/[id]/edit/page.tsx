import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/session';
import { canEditEvent } from '@/lib/permissions';
import { eventInclude, type EventWithRelations } from '@/server/events';
import { buildWizardContext } from '@/server/wizard-context';
import { EventWizard } from '@/features/events/wizard/wizard';
import { valuesFromEvent } from '@/features/events/wizard/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit report' };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const event = (await prisma.event.findUnique({ where: { id }, include: eventInclude })) as EventWithRelations | null;
  if (!event || event.deletedAt) notFound();
  if (!canEditEvent(user, event)) redirect(`/events/${id}?locked=1`);

  const ctx = await buildWizardContext();

  return (
    <EventWizard
      mode="edit"
      ctx={ctx}
      eventId={event.id}
      eventCode={event.eventId}
      initialValues={valuesFromEvent(event)}
      initialPhotos={event.photos.map((p) => ({
        id: p.id,
        fileName: p.fileName,
        caption: p.caption,
        sortOrder: p.sortOrder,
        syncStatus: p.syncStatus,
      }))}
      initialDocuments={event.documents.map((d) => ({
        id: d.id,
        category: d.category,
        fileName: d.fileName,
        size: d.size,
        label: d.label,
      }))}
    />
  );
}
