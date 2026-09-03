import { ROLE_LABELS } from './constants';
import type { Role } from '@/generated/prisma/enums';

export { ROLE_LABELS };

/** Plain-language summary of each role, shown on the profile page. */
export const ROLE_PERMISSION_HINTS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'Full access to every event, member and setting',
    'Manage club settings, avenues and required fields',
    'Connect Google Drive and retry failed syncs',
    'Generate, export and permanently delete',
  ],
  PRESIDENT: [
    'See every event in the club',
    'Review, approve and unlock reports',
    'Generate monthly, avenue and annual reports',
    'Export event data and view analytics',
  ],
  SECRETARY: [
    'See every event in the club',
    'Review, request corrections and approve',
    'Generate and export reports',
    'View analytics and reporting health',
  ],
  DIRECTOR: [
    'See events filed under your avenue',
    'Review and approve reports in your avenue',
    'Report your own events',
    'View analytics',
  ],
  BOARD_MEMBER: [
    'Report new events and save drafts',
    'Upload photos and evidence',
    'Submit reports and respond to correction requests',
    'See your own submissions',
  ],
  VIEWER: ['Read approved reports'],
};
