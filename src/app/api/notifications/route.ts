import { z } from 'zod';
import { apiError, ok } from '@/lib/api';
import { apiUser, unauthorized } from '@/server/session';
import { listNotifications, markRead, unreadCount } from '@/server/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    const [items, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
    return ok({ items, unread });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    const body = z.object({ ids: z.array(z.string()).optional() }).parse(await req.json().catch(() => ({})));
    await markRead(user.id, body.ids);
    return ok({ unread: await unreadCount(user.id) });
  } catch (error) {
    return apiError(error);
  }
}
