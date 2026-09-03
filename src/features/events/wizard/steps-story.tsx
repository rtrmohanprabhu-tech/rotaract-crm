'use client';

import * as React from 'react';
import { Plus, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, YesNo } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { SOCIAL_LABELS } from '@/lib/constants';
import type { StepProps } from './steps-details';

export function StepDescription({
  values,
  set,
  ctx,
  errors,
  eventId = null,
}: StepProps & { eventId?: string | null }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [previous, setPrevious] = React.useState<string | null>(null);

  const text = values.description || values.rawDescription;

  async function improve() {
    if (!eventId) {
      toast.error('Save the draft first', 'Continue past the first step so we have something to work with.');
      return;
    }
    const source = values.rawDescription || values.description;
    if (source.trim().length < 15) {
      toast.error('Write a little more first', 'Even one honest sentence is enough — the assistant only polishes your own words.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'improve_description', eventId, text: source }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error('AI assistance unavailable', data.error ?? 'Please try again later.');
        return;
      }
      setPrevious(values.description);
      if (!values.rawDescription) set('rawDescription', source);
      set('description', data.text);
      toast.success('Description improved', 'Edit it freely — nothing is saved until you continue.');
    } catch {
      toast.error('AI assistance failed', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-ink-800">Tell us what happened</h3>
        <p className="mt-1 text-sm text-ink-500">Plain words are perfect. Don&apos;t worry about formatting — we handle that.</p>
      </div>

      <Field label="What did you do?" required error={errors.description}>
        {(props) => (
          <Textarea
            {...props}
            value={text}
            onChange={(e) => (values.description ? set('description', e.target.value) : set('rawDescription', e.target.value))}
            placeholder="Briefly explain what you did, why the event was conducted, who benefited, and what was achieved. Don't worry about formatting."
            className="min-h-[200px]"
          />
        )}
      </Field>

      <p className="text-xs text-ink-400">
        Example: “We donated a mixer grinder to the school kitchen to help prepare nutritious meals for students.”
      </p>

      {ctx.aiAvailable && ctx.settings.aiEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="subtle" onClick={improve} loading={busy}>
            <Sparkles className="h-4 w-4" /> Improve description
          </Button>
          {previous !== null ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                set('description', previous);
                setPrevious(null);
              }}
            >
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
          ) : null}
          <span className="text-xs text-ink-400">Optional. The assistant only rewrites what you typed — it never adds facts.</span>
        </div>
      ) : null}

      {values.rawDescription && values.description && values.rawDescription !== values.description ? (
        <details className="rounded-xl border border-ink-200 bg-ink-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-700">Your original notes</summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600">{values.rawDescription}</p>
        </details>
      ) : null}
    </div>
  );
}

export function StepOutcome({ values, set, ctx }: StepProps) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">All optional — but these answers make the annual report much stronger.</p>

      <Field label="What was the main objective?" optional>
        {(props) => (
          <Textarea {...props} className="min-h-[80px]" value={values.objective} onChange={(e) => set('objective', e.target.value)} />
        )}
      </Field>
      <Field label="What was accomplished?" optional>
        {(props) => (
          <Textarea {...props} className="min-h-[80px]" value={values.accomplished} onChange={(e) => set('accomplished', e.target.value)} />
        )}
      </Field>
      <Field label="What was the impact?" optional>
        {(props) => <Textarea {...props} className="min-h-[80px]" value={values.impact} onChange={(e) => set('impact', e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Any special outcome?" optional>
          {(props) => (
            <Textarea {...props} className="min-h-[80px]" value={values.specialOutcome} onChange={(e) => set('specialOutcome', e.target.value)} />
          )}
        </Field>
        <Field label="Any feedback received?" optional>
          {(props) => <Textarea {...props} className="min-h-[80px]" value={values.feedback} onChange={(e) => set('feedback', e.target.value)} />}
        </Field>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-4">
        <p className="field-label">Was this part of a larger project?</p>
        <YesNo value={values.isPartOfProject} name="Project" onChange={(v) => set('isPartOfProject', v)} />
        {values.isPartOfProject ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Project" hint="Pick an existing project so all phases stay linked.">
              {(props) => (
                <Select
                  {...props}
                  value={values.projectId}
                  onChange={(e) => {
                    set('projectId', e.target.value);
                    const project = ctx.projects.find((p) => p.id === e.target.value);
                    if (project) set('projectName', project.name);
                  }}
                >
                  <option value="">New / not listed…</option>
                  {ctx.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {!values.projectId ? (
              <Field label="Project name">
                {(props) => (
                  <Input {...props} value={values.projectName} onChange={(e) => set('projectName', e.target.value)} placeholder="e.g. அவளுக்காக" />
                )}
              </Field>
            ) : null}
            <Field label="Phase number" optional>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  value={values.phaseNumber}
                  onChange={(e) => set('phaseNumber', e.target.value)}
                  placeholder="6"
                />
              )}
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StepSocial({ values, set }: StepProps) {
  const published = values.socialLinks.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Was this event published online?</p>
        <YesNo
          value={published}
          name="Published online"
          onChange={(v) => set('socialLinks', v ? [{ platform: 'INSTAGRAM', url: '' }] : [])}
        />
      </div>

      {published ? (
        <>
          {values.socialLinks.map((link, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-3.5 sm:flex-row sm:items-end">
              <Field label="Platform" className="sm:max-w-[200px]">
                {(props) => (
                  <Select
                    {...props}
                    value={link.platform}
                    onChange={(e) =>
                      set(
                        'socialLinks',
                        values.socialLinks.map((l, i) => (i === index ? { ...l, platform: e.target.value } : l)),
                      )
                    }
                  >
                    {Object.entries(SOCIAL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Link" className="flex-1">
                {(props) => (
                  <Input
                    {...props}
                    type="url"
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) =>
                      set(
                        'socialLinks',
                        values.socialLinks.map((l, i) => (i === index ? { ...l, url: e.target.value } : l)),
                      )
                    }
                  />
                )}
              </Field>
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => set('socialLinks', values.socialLinks.filter((_, i) => i !== index))}
                className="mb-1 self-end rounded-lg p-2.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() => set('socialLinks', [...values.socialLinks, { platform: 'INSTAGRAM', url: '' }])}
          >
            <Plus className="h-4 w-4" /> Add another link
          </Button>
        </>
      ) : (
        <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
          No problem — you can add links later from the event page.
        </p>
      )}
    </div>
  );
}
