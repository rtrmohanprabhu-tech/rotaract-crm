import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export type ReportSections = Record<string, boolean>;

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  eventName: true,
  chair: true,
  date: true,
  avenue: true,
  cost: true,
  beneficiaries: true,
  participation: true,
  venue: true,
  description: true,
  impact: true,
  collaboration: true,
  socialMedia: false,
  photos: true,
  internalNotes: false,
  reviewerComments: false,
};

/**
 * Club settings are a singleton row. Every value here is admin-editable — the
 * reference PDF's club details are only ever seeded as examples (§28).
 */
export const getClubSettings = cache(async () => {
  const existing = await prisma.clubSettings.findUnique({ where: { id: 'club' } });
  if (existing) return existing;
  return prisma.clubSettings.create({ data: { id: 'club' } });
});

export async function getReportSections(): Promise<ReportSections> {
  const settings = await getClubSettings();
  return { ...DEFAULT_REPORT_SECTIONS, ...((settings.reportSections as ReportSections | null) ?? {}) };
}

export const getAvenues = cache(async () => {
  return prisma.avenue.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
});

export const getBoardMembers = cache(async () => {
  return prisma.user.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      avenueId: true,
      boardPosition: { select: { title: true } },
    },
  });
});

export const getProjects = cache(async () => {
  return prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
});

export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}
