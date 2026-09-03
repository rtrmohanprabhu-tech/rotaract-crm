import { redirect } from 'next/navigation';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { buildWizardContext } from '@/server/wizard-context';
import { EventWizard } from '@/features/events/wizard/wizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Report an event' };

export default async function NewEventPage() {
  const user = await requireUser();
  if (!can(user, 'event.create')) redirect('/dashboard');

  const ctx = await buildWizardContext();
  return <EventWizard mode="create" ctx={ctx} />;
}
