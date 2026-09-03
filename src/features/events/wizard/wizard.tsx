'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  CloudOff,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { WIZARD_STEPS } from '@/lib/constants';
import { computeCompleteness } from '@/lib/completeness';
import { cn, formatCurrency, formatNumber, relativeTime } from '@/lib/utils';
import { createEventAction, saveEventAction, submitEventAction } from '@/server/actions/events';
import { PhotoUploader, type PhotoItem } from './photo-uploader';
import { DocumentUploader, type DocumentItem } from './document-uploader';
import { StepBasics, StepCollaboration, StepLeadership, StepVenue } from './steps-details';
import { StepBeneficiaries, StepFinancials, StepParticipation } from './steps-impact';
import { StepDescription, StepOutcome, StepSocial } from './steps-story';
import { defaultValues, toPayload, type WizardContextData, type WizardValues } from './types';

type Props = {
  ctx: WizardContextData;
  initialValues?: WizardValues;
  eventId?: string | null;
  eventCode?: string | null;
  initialPhotos?: PhotoItem[];
  initialDocuments?: DocumentItem[];
  mode: 'create' | 'edit';
};

const STORAGE_PREFIX = 'rotaract-crm:draft:';

export function EventWizard({
  ctx,
  initialValues,
  eventId: initialEventId = null,
  eventCode = null,
  initialPhotos = [],
  initialDocuments = [],
  mode,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState<WizardValues>(
    () => initialValues ?? defaultValues({ avenueId: ctx.avenues[0]?.id ?? '' }),
  );
  const [eventId, setEventId] = React.useState<string | null>(initialEventId);
  const [photos, setPhotos] = React.useState<PhotoItem[]>(initialPhotos);
  const [documents, setDocuments] = React.useState<DocumentItem[]>(initialDocuments);
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<Date | null>(initialEventId ? new Date() : null);
  const [submitting, setSubmitting] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const dirty = React.useRef(false);

  const storageKey = `${STORAGE_PREFIX}${initialEventId ?? 'new'}`;

  const set = React.useCallback(<K extends keyof WizardValues>(key: K, value: WizardValues[K]) => {
    dirty.current = true;
    setValues((current) => ({ ...current, [key]: value }));
  }, []);

  // ---- offline / recovery -------------------------------------------------
  React.useEffect(() => {
    const online = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', down);
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', down);
    };
  }, []);

  React.useEffect(() => {
    if (mode !== 'create') return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { values: WizardValues; savedAt: string };
        if (parsed.values?.eventName) {
          setValues(parsed.values);
          toast.push({ kind: 'info', title: 'Recovered your unsaved draft', description: 'We restored what you typed last time.' });
        }
      }
    } catch {
      /* corrupt cache — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ values, savedAt: new Date().toISOString() }));
    } catch {
      /* private mode / quota — autosave to the server still works */
    }
  }, [values, storageKey]);

  // ---- persistence --------------------------------------------------------
  const persist = React.useCallback(
    async (options?: { silent?: boolean }): Promise<string | null> => {
      if (!values.eventName.trim()) return eventId;
      setSaving(true);
      try {
        if (!eventId) {
          const result = await createEventAction(toPayload(values));
          if (!result.ok) {
            setErrors(result.fieldErrors ?? {});
            if (!options?.silent) toast.error('Could not save the draft', result.message);
            return null;
          }
          setEventId(result.data!.id);
          setSavedAt(new Date());
          dirty.current = false;
          localStorage.removeItem(storageKey);
          return result.data!.id;
        }
        const result = await saveEventAction(eventId, toPayload(values));
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          if (!options?.silent) toast.error('Could not save', result.message);
          return null;
        }
        setErrors({});
        setSavedAt(new Date());
        dirty.current = false;
        return eventId;
      } catch {
        if (!options?.silent) {
          toast.error('Save failed', 'Your answers are kept in this browser — reconnect and press Save draft.');
        }
        return null;
      } finally {
        setSaving(false);
      }
    },
    [eventId, storageKey, toast, values],
  );

  // Debounced autosave (§37)
  React.useEffect(() => {
    if (!eventId || !dirty.current) return;
    const timer = setTimeout(() => void persist({ silent: true }), 2500);
    return () => clearTimeout(timer);
  }, [values, eventId, persist]);

  // ---- completeness -------------------------------------------------------
  const completeness = React.useMemo(
    () =>
      computeCompleteness(
        {
          eventName: values.eventName,
          eventDate: values.eventDate,
          avenueId: values.avenueId,
          chairId: values.chairId,
          chairNameText: values.chairNameText,
          eventType: values.eventType,
          venue: values.venue,
          platform: values.platform,
          rotaractorsPresent: Number(values.rotaractorsPresent || 0),
          rotariansPresent: Number(values.rotariansPresent || 0),
          councilPresent: Number(values.councilPresent || 0),
          guestsPresent: Number(values.guestsPresent || 0),
          beneficiaryCount: values.beneficiaryCategories.length,
          directBeneficiaries: Number(values.directBeneficiaries || 0),
          indirectBeneficiaries: Number(values.indirectBeneficiaries || 0),
          description: values.description || values.rawDescription,
          objective: values.objective,
          impact: values.impact,
          photoCount: photos.length,
          posterCount: documents.filter((d) => d.category === 'POSTER').length,
          documentCount: documents.filter((d) => d.category !== 'POSTER').length,
          socialLinkCount: values.socialLinks.filter((s) => s.url).length,
          hasExpenses: values.hasExpenses,
          eventCost: Number(values.eventCost || 0),
          fundingSource: values.fundingSource,
          isCollaboration: values.isCollaboration,
          collaboratorCount: values.collaborators.filter((c) => c.orgName).length,
        },
        { minPhotos: ctx.settings.minPhotos, requiredFields: ctx.settings.requiredFields },
      ),
    [values, photos.length, documents, ctx.settings.minPhotos, ctx.settings.requiredFields],
  );

  // ---- navigation ---------------------------------------------------------
  const current = WIZARD_STEPS[step];
  const isLast = step === WIZARD_STEPS.length - 1;

  function validateStep(): boolean {
    const next: Record<string, string> = {};
    if (current.key === 'basics') {
      if (values.eventName.trim().length < 3) next.eventName = 'Give the event a name.';
      if (!values.eventDate) next.eventDate = 'Pick the date it happened.';
      if (!values.avenueId) next.avenueId = 'Choose an avenue of service.';
    }
    if (current.key === 'venue' && values.eventType !== 'ONLINE' && !values.venue.trim()) {
      next.venue = 'Where did it happen?';
    }
    if (current.key === 'financials' && values.hasExpenses) {
      if (!(Number(values.eventCost) > 0)) next.eventCost = 'Enter the amount spent.';
      if (!values.fundingSource) next.fundingSource = 'Where did the money come from?';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function goNext() {
    if (!validateStep()) {
      toast.error('A couple of things are missing', 'Check the highlighted fields.');
      return;
    }
    const id = await persist({ silent: true });
    if (!id && !eventId) return; // creation failed; errors already shown
    setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function onSubmit() {
    const id = await persist();
    if (!id) return;
    setSubmitting(true);
    const result = await submitEventAction(id);
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast.error('Not submitted yet', result.message);
      return;
    }
    localStorage.removeItem(storageKey);
    toast.success('Report submitted successfully', 'Your reviewers have been notified.');
    router.push(`/events/${id}?submitted=1`);
    router.refresh();
  }

  const stepProps = { values, set, ctx, errors };

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
            {mode === 'create' ? 'Report an event' : 'Edit report'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">
            {values.eventName || 'New event report'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {eventCode ? `${eventCode} · ` : ''}Step {step + 1} of {WIZARD_STEPS.length} — {current.title}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {offline ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
              <CloudOff className="h-3.5 w-3.5" /> Offline — answers kept on this device
            </span>
          ) : saving ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Draft saved {relativeTime(savedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Step rail */}
      <div className="mb-5 overflow-x-auto scroll-area">
        <ol className="flex min-w-max gap-1.5 pb-1">
          {WIZARD_STEPS.map((s, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => index <= step && setStep(index)}
                  disabled={index > step}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition',
                    active && 'bg-brand-600 text-white',
                    done && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
                    !active && !done && 'bg-ink-100 text-ink-400',
                  )}
                >
                  <span className="tabular-nums">{index + 1}</span>
                  <span>{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink-800">{current.title}</h2>

          {current.key === 'basics' ? <StepBasics {...stepProps} /> : null}
          {current.key === 'leadership' ? <StepLeadership {...stepProps} /> : null}
          {current.key === 'venue' ? <StepVenue {...stepProps} /> : null}
          {current.key === 'collaboration' ? <StepCollaboration {...stepProps} /> : null}
          {current.key === 'participation' ? <StepParticipation {...stepProps} /> : null}
          {current.key === 'beneficiaries' ? <StepBeneficiaries {...stepProps} /> : null}
          {current.key === 'financials' ? <StepFinancials {...stepProps} /> : null}
          {current.key === 'description' ? <StepDescription {...stepProps} eventId={eventId} /> : null}
          {current.key === 'impact' ? <StepOutcome {...stepProps} /> : null}
          {current.key === 'photos' ? (
            <PhotoUploader
              eventId={eventId}
              photos={photos}
              onChange={setPhotos}
              minPhotos={ctx.settings.minPhotos}
              maxPhotos={ctx.settings.maxPhotos}
            />
          ) : null}
          {current.key === 'evidence' ? (
            <DocumentUploader eventId={eventId} documents={documents} onChange={setDocuments} />
          ) : null}
          {current.key === 'social' ? <StepSocial {...stepProps} /> : null}
          {current.key === 'review' ? (
            <ReviewSummary values={values} ctx={ctx} photos={photos} documents={documents} />
          ) : null}
        </div>

        {/* Completeness rail */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Report completeness</p>
              <span className="text-2xl font-semibold text-ink-900 tabular-nums">{completeness.score}%</span>
            </div>
            <ProgressBar value={completeness.score} />
            <p className={cn('mt-3 text-sm', completeness.canSubmit ? 'text-emerald-700' : 'text-ink-600')}>
              {completeness.summary}
            </p>

            <ul className="mt-3 space-y-1.5 text-sm">
              {completeness.checks
                .filter((c) => c.ok)
                .slice(0, 20)
                .map((check) => (
                  <li key={check.key} className="flex items-start gap-2 text-ink-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {check.label}
                  </li>
                ))}
              {[...completeness.missingRequired, ...completeness.missingOptional].map((check) => (
                <li key={check.key} className={cn('flex items-start gap-2', check.required ? 'text-orange-700' : 'text-ink-400')}>
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {check.label}
                    {check.required ? ' (required)' : ''}
                    {check.hint ? <span className="block text-xs text-ink-400">{check.hint}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block">
            <NavButtons
              step={step}
              isLast={isLast}
              onBack={goBack}
              onNext={goNext}
              onSave={() => persist()}
              onSubmit={onSubmit}
              saving={saving}
              submitting={submitting}
              canSubmit={completeness.canSubmit}
              eventId={eventId}
            />
          </div>
        </aside>
      </div>

      {/* Sticky action bar on mobile */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-ink-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <NavButtons
          step={step}
          isLast={isLast}
          onBack={goBack}
          onNext={goNext}
          onSave={() => persist()}
          onSubmit={onSubmit}
          saving={saving}
          submitting={submitting}
          canSubmit={completeness.canSubmit}
          eventId={eventId}
          compact
        />
      </div>
    </div>
  );
}

function NavButtons({
  step,
  isLast,
  onBack,
  onNext,
  onSave,
  onSubmit,
  saving,
  submitting,
  canSubmit,
  eventId,
  compact,
}: {
  step: number;
  isLast: boolean;
  onBack: () => void;
  onNext: () => void;
  onSave: () => void;
  onSubmit: () => void;
  saving: boolean;
  submitting: boolean;
  canSubmit: boolean;
  eventId: string | null;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex gap-2', compact ? 'items-center' : 'flex-col')}>
      {isLast ? (
        <>
          <Button variant="secondary" onClick={onBack} className={compact ? '' : 'order-2'} block={!compact}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={onSubmit} loading={submitting} disabled={!canSubmit} block={!compact} className={cn(compact && 'flex-1')}>
            <Send className="h-4 w-4" /> Submit report
          </Button>
        </>
      ) : (
        <>
          {step > 0 ? (
            <Button variant="secondary" onClick={onBack} className={compact ? '' : 'order-2'} block={!compact}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : null}
          <Button onClick={onNext} loading={saving} block={!compact} className={cn(compact && 'flex-1')}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      )}
      {!compact ? (
        <>
          <Button variant="ghost" onClick={onSave} className="order-3" block>
            <Save className="h-4 w-4" /> Save draft
          </Button>
          {eventId ? (
            <Link href={`/events/${eventId}`} className="order-4 text-center text-xs text-ink-400 hover:text-ink-600">
              Leave and view this report
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ReviewSummary({
  values,
  ctx,
  photos,
  documents,
}: {
  values: WizardValues;
  ctx: WizardContextData;
  photos: PhotoItem[];
  documents: DocumentItem[];
}) {
  const avenue = ctx.avenues.find((a) => a.id === values.avenueId)?.name ?? '—';
  const chair = ctx.members.find((m) => m.id === values.chairId)?.name ?? (values.chairNameText || '—');
  const total =
    Number(values.rotaractorsPresent || 0) +
    Number(values.rotariansPresent || 0) +
    Number(values.councilPresent || 0) +
    Number(values.guestsPresent || 0);

  const rows: Array<[string, React.ReactNode]> = [
    ['Event name', values.eventName || '—'],
    ['Date', values.eventDate || '—'],
    ['Time', [values.startTime, values.endTime].filter(Boolean).join(' – ') || '—'],
    ['Avenue', avenue],
    ['Chair', chair],
    ['Venue / platform', values.eventType === 'ONLINE' ? values.platform || '—' : values.venue || '—'],
    ['Project with', values.isCollaboration ? values.projectWith : 'SELF'],
    ['Participants', `${formatNumber(total)} (Rotaractors ${values.rotaractorsPresent}, Rotarians ${values.rotariansPresent}, Council ${values.councilPresent}, Guests ${values.guestsPresent})`],
    [
      'Beneficiaries',
      `${formatNumber(Number(values.directBeneficiaries || 0) + Number(values.indirectBeneficiaries || 0))}${
        values.beneficiaryCategories.length ? ` · ${values.beneficiaryCategories.length} group(s)` : ''
      }`,
    ],
    ['Cost', formatCurrency(Number(values.eventCost || 0), ctx.settings.currency)],
    ['Photos', `${photos.length} uploaded`],
    ['Documents', `${documents.length} attached`],
    ['Social links', `${values.socialLinks.filter((s) => s.url).length}`],
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-600">Here&apos;s everything we&apos;ll file. You can go back to any step to change it.</p>
      <dl className="divide-y divide-ink-100 rounded-xl border border-ink-200">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
            <dt className="w-48 shrink-0 text-xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
            <dd className="text-sm text-ink-800">{value}</dd>
          </div>
        ))}
      </dl>

      {values.description || values.rawDescription ? (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">Description</p>
          <p className="whitespace-pre-wrap rounded-xl border border-ink-200 bg-ink-50 p-4 text-sm leading-relaxed text-ink-700">
            {values.description || values.rawDescription}
          </p>
        </div>
      ) : null}

      {photos.length ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Photos</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.slice(0, 10).map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={`/api/files/photo/${photo.id}?variant=thumb`}
                alt={photo.caption ?? ''}
                className="aspect-square w-full rounded-lg object-cover"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
