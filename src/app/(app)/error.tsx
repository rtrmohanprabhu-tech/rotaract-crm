'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] render error', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-ink-900">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-ink-600">
        {error.message?.includes('database') || error.message?.includes('connect')
          ? 'The database could not be reached. Check DATABASE_URL and that the database is running.'
          : (error.message ?? 'An unexpected error occurred.')}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <a href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </a>
      </div>
      {error.digest ? <p className="mt-4 text-xs text-ink-400">Reference: {error.digest}</p> : null}
    </div>
  );
}
