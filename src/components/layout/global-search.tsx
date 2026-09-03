'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type Results = {
  events: Array<{ id: string; eventId: string; eventName: string; avenue: string; date: string; chair: string | null; driveUrl: string | null }>;
  members: Array<{ id: string; name: string; email: string }>;
  projects: Array<{ id: string; name: string }>;
};

export function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<Results | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (term.trim().length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        /* aborted or offline — the input keeps working */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hasResults = results && (results.events.length || results.members.length || results.projects.length);

  return (
    <div ref={boxRef} className="relative max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (term.trim()) router.push(`/events?q=${encodeURIComponent(term.trim())}`);
          setOpen(false);
        }}
      >
        <label htmlFor="global-search" className="sr-only">
          Search events, members and projects
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          id="global-search"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search events, members, projects…"
          className="h-10 w-full rounded-xl border border-ink-200 bg-ink-50/60 pl-9 pr-9 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
          autoComplete="off"
        />
        {loading ? <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" /> : null}
      </form>

      {open && term.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-12 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-ink-200 bg-white p-2 shadow-pop">
          {!hasResults && !loading ? (
            <p className="px-3 py-6 text-center text-sm text-ink-500">No matches for “{term}”.</p>
          ) : null}

          {results?.events.length ? (
            <div className="mb-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Events</p>
              {results.events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 hover:bg-ink-50"
                >
                  <p className="truncate text-sm font-medium text-ink-800">{event.eventName}</p>
                  <p className="truncate text-xs text-ink-500">
                    {event.eventId} · {event.avenue} · {formatDate(event.date)}
                    {event.chair ? ` · ${event.chair}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          ) : null}

          {results?.projects.length ? (
            <div className="mb-1">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Projects</p>
              {results.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                >
                  {project.name}
                </Link>
              ))}
            </div>
          ) : null}

          {results?.members.length ? (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Members</p>
              {results.members.map((member) => (
                <Link
                  key={member.id}
                  href={`/members?q=${encodeURIComponent(member.name)}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 hover:bg-ink-50"
                >
                  <p className="text-sm text-ink-800">{member.name}</p>
                  <p className="text-xs text-ink-500">{member.email}</p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
