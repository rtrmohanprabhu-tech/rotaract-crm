import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { visibilityWhere } from '@/server/search';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EventTable } from '@/components/events/event-table';
import { ProjectForm } from '@/features/projects/project-form';
import { StatCard } from '@/components/ui/misc';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { eventInclude } from '@/server/events';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const events = await prisma.event.findMany({
    where: { AND: [{ projectId: id, deletedAt: null }, visibilityWhere(user)] },
    include: eventInclude,
    orderBy: [{ phaseNumber: 'asc' }, { eventDate: 'asc' }],
  });

  const totals = events.reduce(
    (acc, e) => ({
      participants: acc.participants + e.totalParticipants,
      beneficiaries: acc.beneficiaries + e.totalBeneficiaries,
      cost: acc.cost + Number(e.eventCost),
      photos: acc.photos + e.photos.length,
    }),
    { participants: 0, beneficiaries: 0, cost: 0, photos: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">{project.name}</h1>
        {project.description ? <p className="mt-1 text-sm text-ink-500">{project.description}</p> : null}
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Events" value={formatNumber(events.length)} />
        <StatCard label="Phases" value={formatNumber(new Set(events.map((e) => e.phaseNumber).filter(Boolean)).size)} />
        <StatCard label="Participants" value={formatNumber(totals.participants)} />
        <StatCard label="Beneficiaries" value={formatNumber(totals.beneficiaries)} />
        <StatCard label="Total spend" value={formatCurrency(totals.cost)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Project timeline</CardTitle>
          <span className="text-sm text-ink-500">{totals.photos} photographs on file</span>
        </CardHeader>
        <CardBody>
          <EventTable rows={events} columns={['avenue', 'chair', 'participants', 'beneficiaries', 'cost', 'drive']} emptyMessage="No events linked to this project yet." />
        </CardBody>
      </Card>

      {can(user, 'projects.manage') ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit project</CardTitle>
          </CardHeader>
          <CardBody>
            <ProjectForm project={{ id: project.id, name: project.name, description: project.description }} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
