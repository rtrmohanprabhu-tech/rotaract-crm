import { readFileSync } from 'node:fs';
import { google, type drive_v3 } from 'googleapis';
import { prisma } from '@/lib/prisma';

/**
 * Google Drive authentication (§50).
 *
 * Two supported modes, both server-side only — credentials never reach the
 * browser:
 *   1. Service account (GOOGLE_SERVICE_ACCOUNT_JSON / _FILE). Share the root
 *      folder with the service account email. Best for unattended servers.
 *   2. An admin connects their own Google account once at /settings/drive; the
 *      refresh token is stored in the drive_credentials table.
 */

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

export type DriveConfig = {
  mode: 'service_account' | 'oauth' | 'none';
  rootFolderId?: string | null;
  driveId?: string | null;
};

export class DriveNotConfiguredError extends Error {
  constructor(message = 'Google Drive is not connected yet.') {
    super(message);
  }
}

function serviceAccountCredentials(): { client_email: string; private_key: string } | null {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  try {
    if (inline) return JSON.parse(inline);
    if (file) return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error('[drive] service account credentials could not be parsed', error);
  }
  return null;
}

export function oauthClient(redirectUri?: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri ?? `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/drive/callback`,
  );
}

/** Returns an authorised Drive client, or null when Drive is not set up. */
export async function getDrive(): Promise<drive_v3.Drive | null> {
  const sa = serviceAccountCredentials();
  if (sa?.client_email && sa.private_key) {
    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key.replace(/\\n/g, '\n'),
      scopes: DRIVE_SCOPES,
    });
    return google.drive({ version: 'v3', auth: jwt });
  }

  const credential = await prisma.driveCredential.findFirst();
  const client = oauthClient();
  if (credential?.refreshToken && client) {
    client.setCredentials({ refresh_token: credential.refreshToken });
    return google.drive({ version: 'v3', auth: client });
  }
  return null;
}

export async function driveConfig(): Promise<DriveConfig> {
  const settings = await prisma.clubSettings.findUnique({ where: { id: 'club' } });
  const rootFolderId = settings?.driveRootFolderId || process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
  const driveId = process.env.GOOGLE_DRIVE_ID || null;
  if (serviceAccountCredentials()) return { mode: 'service_account', rootFolderId, driveId };
  const credential = await prisma.driveCredential.findFirst();
  if (credential) return { mode: 'oauth', rootFolderId, driveId };
  return { mode: 'none', rootFolderId, driveId };
}

export async function isDriveReady() {
  const config = await driveConfig();
  return config.mode !== 'none' && Boolean(config.rootFolderId);
}

/** Shared-drive aware request defaults. */
export function driveParams(driveId?: string | null) {
  return driveId
    ? { supportsAllDrives: true, includeItemsFromAllDrives: true, driveId, corpora: 'drive' as const }
    : { supportsAllDrives: true, includeItemsFromAllDrives: true };
}
