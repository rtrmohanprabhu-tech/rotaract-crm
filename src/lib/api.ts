import { NextResponse } from 'next/server';
import { HttpError } from '@/server/session';

/**
 * Consistent JSON errors with human-readable messages (§57) — never
 * "Something went wrong".
 */
export function apiError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  console.error('[api]', error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as never, init);
}

/** Very small in-memory rate limiter for upload/AI endpoints (§33). */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count };
}
