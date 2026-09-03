'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, LockOpen, RefreshCw, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { deleteEventAction, submitEventAction, unlockEventAction } from '@/server/actions/events';

export function SubmitButton({ eventId, label = 'Submit report' }: { eventId: string; label?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      loading={pending}
      onClick={async () => {
        setPending(true);
        const result = await submitEventAction(eventId);
        setPending(false);
        if (!result.ok) {
          toast.error('Not submitted', result.message);
          return;
        }
        toast.success('Report submitted successfully', 'Your reviewers have been notified.');
        router.refresh();
      }}
    >
      <Send className="h-4 w-4" /> {label}
    </Button>
  );
}

export function UnlockButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const result = await unlockEventAction(eventId);
        setPending(false);
        toast[result.ok ? 'success' : 'error'](result.message ?? '');
        router.refresh();
      }}
    >
      <LockOpen className="h-4 w-4" /> Unlock for editing
    </Button>
  );
}

export function DeleteButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" /> Archive
      </Button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm text-ink-600">Archive this report?</span>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        onClick={async () => {
          setPending(true);
          const result = await deleteEventAction(eventId);
          setPending(false);
          if (!result.ok) {
            toast.error('Not archived', result.message);
            return;
          }
          toast.success(result.message ?? 'Archived');
          router.push('/events');
        }}
      >
        Yes, archive
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}

export function GenerateReportButton({
  eventId,
  existingReportId,
}: {
  eventId: string;
  existingReportId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [reportId, setReportId] = React.useState<string | null>(existingReportId ?? null);

  async function generate() {
    setPending(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'EVENT', eventId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Report not generated', data.error ?? 'Please try again.');
        return;
      }
      setReportId(data.report.id);
      toast.success(
        'Report generated',
        data.drive?.ok ? 'It has been filed into 06_Generated_Report on Google Drive.' : (data.drive?.message ?? undefined),
      );
      router.refresh();
    } catch {
      toast.error('Report not generated', 'The server could not be reached.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={generate} loading={pending} variant={reportId ? 'secondary' : 'primary'}>
        <FileText className="h-4 w-4" /> {reportId ? 'Regenerate report' : 'Generate report'}
      </Button>
      {reportId ? (
        <a href={`/api/files/report/${reportId}`} target="_blank" rel="noreferrer">
          <Button variant="ghost">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </a>
      ) : null}
    </div>
  );
}

export function DriveRetryButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await fetch('/api/drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'retry_event', eventId }),
          });
          const data = await res.json();
          toast[data.ok ? 'success' : 'error'](data.message ?? 'Drive sync attempted');
          router.refresh();
        } catch {
          toast.error('Could not reach the server');
        } finally {
          setPending(false);
        }
      }}
    >
      <RefreshCw className="h-4 w-4" /> Retry Drive sync
    </Button>
  );
}
