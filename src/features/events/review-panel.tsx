'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MessageSquare, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { commentAction, reviewEventAction } from '@/server/actions/events';

type Decision = 'START_REVIEW' | 'APPROVED' | 'CORRECTION_REQUESTED' | 'REJECTED' | 'COMMENT';

export function ReviewPanel({
  eventId,
  status,
  canApprove,
}: {
  eventId: string;
  status: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState<Decision | null>(null);

  async function act(decision: Decision) {
    setPending(decision);
    const result = await reviewEventAction(eventId, { decision, note: note.trim() || undefined });
    setPending(null);
    if (!result.ok) {
      toast.error('Could not record that', result.message);
      return;
    }
    toast.success(result.message ?? 'Done');
    setNote('');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <label htmlFor="review-note" className="field-label">
        Note to the board member
      </label>
      <Textarea
        id="review-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Please upload at least 3 event photographs, and check the Rotaractor attendance count."
        className="min-h-[100px]"
      />
      <div className="flex flex-wrap gap-2">
        {status === 'SUBMITTED' ? (
          <Button variant="secondary" onClick={() => act('START_REVIEW')} loading={pending === 'START_REVIEW'}>
            <RotateCcw className="h-4 w-4" /> Start review
          </Button>
        ) : null}
        {canApprove ? (
          <Button variant="success" onClick={() => act('APPROVED')} loading={pending === 'APPROVED'}>
            <CheckCircle2 className="h-4 w-4" /> Approve
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => act('CORRECTION_REQUESTED')} loading={pending === 'CORRECTION_REQUESTED'}>
          <XCircle className="h-4 w-4" /> Request correction
        </Button>
        <Button variant="ghost" onClick={() => act('COMMENT')} loading={pending === 'COMMENT'}>
          <MessageSquare className="h-4 w-4" /> Just comment
        </Button>
      </div>
      <p className="text-xs text-ink-500">
        Approving locks the report so the numbers in club reports cannot drift. An admin can unlock it if something needs
        fixing later.
      </p>
    </div>
  );
}

export function CommentForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = React.useState('');
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await commentAction(eventId, { body, isInternal: false });
        setPending(false);
        if (!result.ok) {
          toast.error('Comment not added', result.message);
          return;
        }
        setBody('');
        router.refresh();
      }}
    >
      <label htmlFor="comment-body" className="sr-only">
        Add a comment
      </label>
      <Textarea
        id="comment-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        className="min-h-[80px]"
        required
      />
      <Button type="submit" size="sm" loading={pending}>
        Post comment
      </Button>
    </form>
  );
}
