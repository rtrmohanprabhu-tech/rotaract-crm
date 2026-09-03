import { prisma } from '@/lib/prisma';

export type AuditInput = {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

/**
 * Audit logging must never break the operation it records (§34) — a failed
 * write is logged to the server console and swallowed.
 */
export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write log entry', input.action, error);
  }
}

export async function auditTrail(entityType: string, entityId: string, take = 50) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { id: true, name: true, image: true, role: true } } },
  });
}
