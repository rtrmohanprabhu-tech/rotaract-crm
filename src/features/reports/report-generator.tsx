'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Select, Toggle } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

type Kind = 'MONTHLY' | 'AVENUE' | 'ANNUAL';

export function ReportGenerator({
  avenues,
  currentYear,
  aiAvailable,
}: {
  avenues: Array<{ id: string; name: string }>;
  currentYear: string;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = React.useState<Kind>('MONTHLY');
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [yearLabel, setYearLabel] = React.useState(currentYear);
  const [avenueId, setAvenueId] = React.useState('');
  const [includePhotos, setIncludePhotos] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ downloadUrl: string; fileName: string; count: number } | null>(null);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summarising, setSummarising] = React.useState(false);

  async function generate() {
    setPending(true);
    setResult(null);
    try {
      const body =
        kind === 'MONTHLY'
          ? { kind, month, avenueId: avenueId || null, includePhotos }
          : kind === 'AVENUE'
            ? { kind, yearLabel, avenueId, includePhotos }
            : { kind, yearLabel, includePhotos };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Report not generated', data.error ?? 'Please try again.');
        return;
      }
      setResult({ downloadUrl: data.report.downloadUrl, fileName: data.report.fileName, count: data.eventCount });
      toast.success(
        `Report ready — ${data.eventCount} approved event${data.eventCount === 1 ? '' : 's'}`,
        data.drive?.ok ? 'Also filed to Google Drive.' : (data.drive?.message ?? undefined),
      );
      router.refresh();
    } catch {
      toast.error('Report not generated', 'The server could not be reached.');
    } finally {
      setPending(false);
    }
  }

  async function makeSummary() {
    setSummarising(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'summarise_period', periodKey: month }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('Summary unavailable', data.error ?? undefined);
        return;
      }
      setSummary(data.text);
    } finally {
      setSummarising(false);
    }
  }

  React.useEffect(() => {
    if (kind === 'AVENUE' && !avenueId && avenues[0]) setAvenueId(avenues[0].id);
  }, [kind, avenueId, avenues]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {(['MONTHLY', 'AVENUE', 'ANNUAL'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            aria-pressed={kind === option}
            className={`h-11 rounded-xl border text-sm font-medium transition ${
              kind === option
                ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
            }`}
          >
            {option === 'MONTHLY' ? 'Monthly' : option === 'AVENUE' ? 'Avenue' : 'Annual'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'MONTHLY' ? (
          <Field label="Month">
            {(props) => (
              <input {...props} type="month" className="input-base" value={month} onChange={(e) => setMonth(e.target.value)} />
            )}
          </Field>
        ) : (
          <Field label="Rotaract year" hint="Runs 1 July to 30 June.">
            {(props) => (
              <input {...props} className="input-base" value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} placeholder="2026-27" />
            )}
          </Field>
        )}

        {kind !== 'ANNUAL' ? (
          <Field label="Avenue" optional={kind === 'MONTHLY'}>
            {(props) => (
              <Select {...props} value={avenueId} onChange={(e) => setAvenueId(e.target.value)}>
                {kind === 'MONTHLY' ? <option value="">All avenues</option> : null}
                {avenues.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
      </div>

      <Toggle
        checked={includePhotos}
        onChange={setIncludePhotos}
        label="Include event photographs"
        description="Turn off for a shorter, text-only report."
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} loading={pending}>
          <FileText className="h-4 w-4" /> Generate report
        </Button>
        {result ? (
          <a href={result.downloadUrl} target="_blank" rel="noreferrer">
            <Button variant="secondary">
              <Download className="h-4 w-4" /> Download {result.fileName}
            </Button>
          </a>
        ) : null}
        {aiAvailable && kind === 'MONTHLY' ? (
          <Button variant="ghost" onClick={makeSummary} loading={summarising}>
            <Sparkles className="h-4 w-4" /> Draft a narrative summary
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-ink-500">
        Reports compile <strong>approved</strong> events only, so the numbers always match what the board signed off.
      </p>

      {summary ? (
        <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Draft summary (editable, not saved)</p>
          <p className="whitespace-pre-wrap text-sm text-ink-700">{summary}</p>
        </div>
      ) : null}
    </div>
  );
}
