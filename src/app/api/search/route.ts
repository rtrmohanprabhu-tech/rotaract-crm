import { apiError, ok } from '@/lib/api';
import { apiUser, unauthorized } from '@/server/session';
import { globalSearch } from '@/server/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    const term = new URL(req.url).searchParams.get('q') ?? '';
    const { events, members, projects } = await globalSearch(term, user);

    return ok({
      events: events.map((e) => ({
        id: e.id,
        eventId: e.eventId,
        eventName: e.eventName,
        avenue: e.avenue.name,
        date: e.eventDate,
        chair: e.chair?.name ?? null,
        status: e.status,
        driveUrl: e.driveFolder?.folderUrl ?? null,
        photoId: e.photos[0]?.id ?? null,
        reportId: e.reports[0]?.id ?? null,
      })),
      members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, image: m.image })),
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (error) {
    return apiError(error);
  }
}
