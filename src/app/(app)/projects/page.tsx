import Link from 'next/link';
import { Layers } from 'lucide-react';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { ProjectForm } from '@/features/projects/project-form';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    include: {
      events: {
        where: { deletedAt: null },
        select: { id: true, totalParticipants: true, totalBeneficiaries: true, eventCost: true, phaseNumber: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink-900">Projects</h1>
        <p className="mt-1 text-sm text-ink-500">
          Group recurring initiatives — like அவளுக்காக Phase 1 through Phase 6 — so the whole arc is visible in one place.
        </p>
      </header>

      {can(user, 'projects.manage') ? (
        <Card>
          <CardHeader>
            <CardTitle>New project</CardTitle>
          </CardHeader>
          <CardBody>
            <ProjectForm />
          </CardBody>
        </Card>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState icon={<Layers className="h-6 w-6" />} title="No projects yet" description="Create one, then link events to it from the wizard." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const totals = project.events.reduce(
              (acc, e) => ({
                participants: acc.participants + e.totalParticipants,
                beneficiaries: acc.beneficiaries + e.totalBeneficiaries,
                cost: acc.cost + Number(e.eventCost),
              }),
              { participants: 0, beneficiaries: 0, cost: 0 },
            );
            const phases = new Set(project.events.map((e) => e.phaseNumber).filter(Boolean)).size;
            return (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`} className="card block p-5 transition hover:shadow-pop">
                  <p className="text-base font-semibold text-ink-800">{project.name}</p>
                  {project.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-500">{project.description}</p> : null}
                  <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Events', formatNumber(project.events.length)],
                      ['Phases', formatNumber(phases)],
                      ['People', formatNumber(totals.participants)],
                      ['Spend', formatCurrency(totals.cost)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-ink-50 py-2">
                        <dt className="text-[10px] uppercase tracking-wide text-ink-500">{label}</dt>
                        <dd className="text-sm font-semibold text-ink-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
