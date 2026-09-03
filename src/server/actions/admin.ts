'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/server/session';
import { can } from '@/lib/permissions';
import { logAudit } from '@/server/audit';
import { clubSettingsSchema, flattenZodError, memberSchema, projectSchema } from '@/lib/validation';
import { slugify } from '@/lib/utils';
import type { ActionResult } from './events';

export async function updateClubSettingsAction(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, 'settings.manage')) return { ok: false, message: 'Only a Super Admin can change club settings.' };

  const parsed = clubSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: flattenZodError(parsed.error) };
  }
  const { driveRootFolderId, reportSections, ...rest } = parsed.data;

  await prisma.clubSettings.upsert({
    where: { id: 'club' },
    create: {
      id: 'club',
      ...rest,
      driveRootFolderId: driveRootFolderId || null,
      ...(reportSections ? { reportSections: reportSections as never } : {}),
    },
    update: {
      ...rest,
      driveRootFolderId: driveRootFolderId || null,
      ...(reportSections ? { reportSections: reportSections as never } : {}),
    },
  });

  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: 'settings.update',
    entityType: 'club',
    entityId: 'club',
    summary: `${user.name} updated club settings`,
  });
  revalidatePath('/settings');
  return { ok: true, message: 'Settings saved.' };
}

export async function upsertMemberAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, 'members.manage')) return { ok: false, message: 'Only an admin can manage members.' };

  const parsed = memberSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors: flattenZodError(parsed.error) };
  }
  const { password, boardPositionId, avenueId, ...data } = parsed.data;
  const email = data.email.toLowerCase().trim();

  const clash = await prisma.user.findFirst({ where: { email, ...(id ? { NOT: { id } } : {}) } });
  if (clash) return { ok: false, message: 'Another member already uses that email.', fieldErrors: { email: 'Already in use' } };

  const payload = {
    ...data,
    email,
    phone: data.phone || null,
    rotaractId: data.rotaractId || null,
    boardPositionId,
    avenueId: avenueId || null,
    ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
  };

  const record = id
    ? await prisma.user.update({ where: { id }, data: payload })
    : await prisma.user.create({ data: payload });

  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: id ? 'member.update' : 'member.create',
    entityType: 'user',
    entityId: record.id,
    summary: `${user.name} ${id ? 'updated' : 'added'} ${record.name} (${record.role})`,
  });
  revalidatePath('/members');
  return { ok: true, data: { id: record.id }, message: id ? 'Member updated.' : 'Member added.' };
}

export async function setMemberActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, 'members.manage')) return { ok: false, message: 'Only an admin can manage members.' };
  if (id === user.id && !isActive) return { ok: false, message: 'You cannot deactivate your own account.' };

  const record = await prisma.user.update({ where: { id }, data: { isActive } });
  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: 'member.status',
    entityType: 'user',
    entityId: id,
    summary: `${user.name} ${isActive ? 'reactivated' : 'deactivated'} ${record.name}`,
  });
  revalidatePath('/members');
  return { ok: true, message: isActive ? 'Member reactivated.' : 'Member deactivated.' };
}

const avenueSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#cd2a63'),
  isActive: z.boolean().default(true),
});

export async function upsertAvenueAction(id: string | null, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!can(user, 'settings.manage')) return { ok: false, message: 'Only a Super Admin can change avenues.' };
  const parsed = avenueSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'Check the avenue name and colour.' };

  const slug = slugify(parsed.data.name);
  if (id) {
    await prisma.avenue.update({ where: { id }, data: { ...parsed.data, slug } });
  } else {
    const count = await prisma.avenue.count();
    await prisma.avenue.create({ data: { ...parsed.data, slug, sortOrder: count } });
  }
  revalidatePath('/settings');
  return { ok: true, message: 'Avenue saved.' };
}

export async function upsertProjectAction(id: string | null, raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!can(user, 'projects.manage')) return { ok: false, message: 'You cannot manage projects.' };
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: 'Please check the project name.', fieldErrors: flattenZodError(parsed.error) };
  }
  const slug = slugify(parsed.data.name);
  const record = id
    ? await prisma.project.update({ where: { id }, data: { ...parsed.data, slug } })
    : await prisma.project.create({ data: { ...parsed.data, slug } });

  await logAudit({
    actorId: user.id,
    actorLabel: user.name,
    action: id ? 'project.update' : 'project.create',
    entityType: 'project',
    entityId: record.id,
    summary: `${user.name} ${id ? 'updated' : 'created'} project "${record.name}"`,
  });
  revalidatePath('/projects');
  return { ok: true, data: { id: record.id }, message: 'Project saved.' };
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath('/notifications');
  return { ok: true };
}
