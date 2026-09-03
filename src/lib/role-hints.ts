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
  SECRETARY_ADMIN: [
    'See every event in the club',
    'Review, request corrections and approve',
    'Generate and export reports',
    'View analytics and reporting health',
    'Manage club members',
  ],
  SECRETARY_COMMUNICATION: [
    'See every event in the club',
    'Edit any event’s communication details — poster, social links, description',
    'Report your own events',
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
  REVIEWER: [
    'See every submitted report awaiting review',
    'Approve reports or request corrections',
    'Cannot create events or manage members',
  ],
  VIEWER: ['Read approved reports'],
};
