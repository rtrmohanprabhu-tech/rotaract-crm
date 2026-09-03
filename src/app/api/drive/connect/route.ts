import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { apiUser, forbidden, unauthorized } from '@/server/session';
import { can } from '@/lib/permissions';
import { DRIVE_SCOPES, oauthClient } from '@/server/drive/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Starts the Drive authorisation flow. Only an admin can do this, and the
 * resulting refresh token is stored server-side (§33, §50).
 */
export async function GET() {
  try {
    const user = await apiUser();
    if (!user) unauthorized();
    if (!can(user, 'drive.manage')) forbidden('Only an admin can connect Google Drive.');

    const client = oauthClient();
    if (!client) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the server.' },
        { status: 503 },
      );
    }

    const state = randomBytes(16).toString('hex');
    const jar = await cookies();
    jar.set('drive_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });

    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: DRIVE_SCOPES,
      state,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    return apiError(error);
  }
}
