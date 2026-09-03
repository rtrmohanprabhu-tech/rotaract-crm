import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can, type ActorLike, type Permission } from '@/lib/permissions';
import type { Role } from '@/generated/prisma/enums';

export type SessionUser = ActorLike & {
  name: string;
  email: string;
  image?: string | null;
  role: Role;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id || !session.user.isActive) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? 'Member',
    email: session.user.email ?? '',
    image: session.user.image,
    role: session.user.role,
    avenueId: session.user.avenueId,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect('/dashboard?denied=1');
  return user;
}

/** API-route flavour: returns null instead of redirecting. */
export async function apiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function unauthorized(message = 'You are not signed in.'): never {
  throw new HttpError(401, message);
}

export function forbidden(message = 'You do not have access to this.'): never {
  throw new HttpError(403, message);
}

export function notFound(message = 'Not found.'): never {
  throw new HttpError(404, message);
}
