import { getAvenues, getBoardMembers, getClubSettings, getProjects } from '@/server/settings';
import { aiEnabled } from '@/server/ai';
import type { WizardContextData } from '@/features/events/wizard/types';

export async function buildWizardContext(): Promise<WizardContextData> {
  const [avenues, members, projects, settings] = await Promise.all([
    getAvenues(),
    getBoardMembers(),
    getProjects(),
    getClubSettings(),
  ]);

  return {
    avenues: avenues.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    members: members.map((m) => ({ id: m.id, name: m.name, role: m.role, position: m.boardPosition?.title ?? null })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    settings: {
      minPhotos: settings.minPhotos,
      maxPhotos: settings.maxPhotos,
      currency: settings.currency,
      requiredFields: settings.requiredFields,
      aiEnabled: settings.aiEnabled,
    },
    aiAvailable: aiEnabled(),
  };
}
