'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { relativeTime } from '@/lib/utils';

type Item = { id: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = React.useState(initialUnread);
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      /* offline — keep the last known count */
    }
  }, []);

  React.useEffect(() => {
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative rounded-xl p-2.5 text-ink-600 transition hover:bg-ink-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-800">Notifications</p>
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={async () => {
                await fetch('/api/notifications', { method: 'POST', body: JSON.stringify({}) });
                setUnread(0);
                setItems((prev) => prev.map((i) => ({ ...i, readAt: new Date().toISOString() })));
              }}
            >
              Mark all read
            </button>
          </div>
          <div className="scroll-area max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">You&apos;re all caught up.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.link ?? '/notifications'}
                  onClick={() => setOpen(false)}
                  className={`block border-b border-ink-50 px-4 py-3 transition hover:bg-ink-50 ${item.readAt ? '' : 'bg-brand-50/40'}`}
                >
                  <p className="text-sm font-medium text-ink-800">{item.title}</p>
                  {item.body ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{item.body}</p> : null}
                  <p className="mt-1 text-[11px] text-ink-400">{relativeTime(item.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block bg-ink-50 px-4 py-2.5 text-center text-xs font-medium text-ink-600 hover:text-ink-800">
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
