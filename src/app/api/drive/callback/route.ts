import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { oauthClient } from '@/server/drive/client';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'drive.manage')) forbidden('Only an admin can connect Google Drive.');

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const jar = await cookies();
    const expected = jar.get('drive_oauth_state')?.value;
    jar.delete('drive_oauth_state');

    if (!code) return NextResponse.redirect(new URL('/settings/drive?error=cancelled', url.origin));
    if (!state || state !== expected) {
      return NextResponse.redirect(new URL('/settings/drive?error=state_mismatch', url.origin));
    }

    const client = oauthClient();
    if (!client) return NextResponse.redirect(new URL('/settings/drive?error=not_configured', url.origin));

    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL('/settings/drive?error=no_refresh_token', url.origin));
    }

    await prisma.driveCredential.upsert({
      where: { id: 'drive' },
      create: { id: 'drive', userId: user.id, refreshToken: tokens.refresh_token, scope: tokens.scope ?? '' },
      update: { userId: user.id, refreshToken: tokens.refresh_token, scope: tokens.scope ?? '' },
    });
    await prisma.clubSettings.upsert({
      where: { id: 'club' },
      create: { id: 'club', driveConnectedById: user.id, driveConnectedAt: new Date() },
      update: { driveConnectedById: user.id, driveConnectedAt: new Date() },
    });

    await logAudit({
      actorId: user.id,
      actorLabel: user.name,
      action: 'drive.connect',
      entityType: 'club',
      entityId: 'club',
      summary: `${user.name} connected the club Google Drive account`,
    });

    return NextResponse.redirect(new URL('/settings/drive?connected=1', url.origin));
  } catch (error) {
    return apiError(error);
  }
}
