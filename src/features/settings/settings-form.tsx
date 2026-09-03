'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Toggle } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { updateClubSettingsAction } from '@/server/actions/admin';

const REQUIRED_FIELD_OPTIONS = [
  { key: 'eventName', label: 'Event name' },
  { key: 'eventDate', label: 'Event date' },
  { key: 'avenueId', label: 'Avenue of service' },
  { key: 'chairId', label: 'Event chair' },
  { key: 'venue', label: 'Venue / platform' },
  { key: 'participation', label: 'Participation numbers' },
  { key: 'beneficiaries', label: 'Beneficiary groups' },
  { key: 'description', label: 'Description' },
  { key: 'photos', label: 'Minimum photographs' },
];

const REPORT_SECTION_OPTIONS = [
  { key: 'chair', label: 'Chair & secretary' },
  { key: 'date', label: 'Date & time' },
  { key: 'avenue', label: 'Avenue of service' },
  { key: 'cost', label: 'Cost & funding' },
  { key: 'beneficiaries', label: 'Beneficiaries' },
  { key: 'participation', label: 'Participation' },
  { key: 'venue', label: 'Venue' },
  { key: 'description', label: 'Description' },
  { key: 'impact', label: 'Objective & impact' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'socialMedia', label: 'Social media links' },
  { key: 'photos', label: 'Photographs' },
  { key: 'internalNotes', label: 'Internal notes' },
  { key: 'reviewerComments', label: 'Reviewer comments' },
];

export type SettingsValues = {
  clubName: string;
  rotarySponsor: string;
  clubId: string;
  groupName: string;
  riDistrict: string;
  presidentName: string;
  secretaryName: string;
  currentYear: string;
  currency: string;
  minPhotos: number;
  maxPhotos: number;
  reportingDeadlineHrs: number;
  requiredFields: string[];
  aiEnabled: boolean;
  reportSections: Record<string, boolean>;
};

export function SettingsForm({ initial, aiConfigured }: { initial: SettingsValues; aiConfigured: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const set = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) =>
    setValues((c) => ({ ...c, [key]: value }));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await updateClubSettingsAction(values);
        setPending(false);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error('Settings not saved', result.message);
          return;
        }
        setErrors({});
        toast.success('Settings saved');
        router.refresh();
      }}
    >
      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold text-ink-800">Club identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Club name" required error={errors.clubName}>
            {(props) => <Input {...props} value={values.clubName} onChange={(e) => set('clubName', e.target.value)} />}
          </Field>
          <Field label="Sponsored by (Rotary club)" optional>
            {(props) => <Input {...props} value={values.rotarySponsor} onChange={(e) => set('rotarySponsor', e.target.value)} />}
          </Field>
          <Field label="Club ID" optional>
            {(props) => <Input {...props} value={values.clubId} onChange={(e) => set('clubId', e.target.value)} />}
          </Field>
          <Field label="Group" optional>
            {(props) => <Input {...props} value={values.groupName} onChange={(e) => set('groupName', e.target.value)} />}
          </Field>
          <Field label="RI District" optional>
            {(props) => <Input {...props} value={values.riDistrict} onChange={(e) => set('riDistrict', e.target.value)} />}
          </Field>
          <Field label="Rotaract year" required error={errors.currentYear} hint="Format 2026-27. Drives the Drive folder tree and annual reports.">
            {(props) => <Input {...props} value={values.currentYear} onChange={(e) => set('currentYear', e.target.value)} />}
          </Field>
          <Field label="President" optional>
            {(props) => <Input {...props} value={values.presidentName} onChange={(e) => set('presidentName', e.target.value)} />}
          </Field>
          <Field label="Secretary" optional>
            {(props) => <Input {...props} value={values.secretaryName} onChange={(e) => set('secretaryName', e.target.value)} />}
          </Field>
          <Field label="Currency code" required error={errors.currency}>
            {(props) => <Input {...props} value={values.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} maxLength={3} />}
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-800">Reporting policy</h2>
        <p className="mb-4 text-sm text-ink-500">These rules drive the completeness score and what blocks submission.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum photos" required error={errors.minPhotos}>
            {(props) => (
              <Input {...props} type="number" min={0} value={values.minPhotos} onChange={(e) => set('minPhotos', Number(e.target.value))} />
            )}
          </Field>
          <Field label="Maximum photos" required error={errors.maxPhotos}>
            {(props) => (
              <Input {...props} type="number" min={1} value={values.maxPhotos} onChange={(e) => set('maxPhotos', Number(e.target.value))} />
            )}
          </Field>
          <Field label="Reporting deadline (hours)" required error={errors.reportingDeadlineHrs} hint="After the event date.">
            {(props) => (
              <Input
                {...props}
                type="number"
                min={1}
                value={values.reportingDeadlineHrs}
                onChange={(e) => set('reportingDeadlineHrs', Number(e.target.value))}
              />
            )}
          </Field>
        </div>

        <p className="field-label mt-5">Required before submission</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {REQUIRED_FIELD_OPTIONS.map((option) => (
            <Toggle
              key={option.key}
              label={option.label}
              checked={values.requiredFields.includes(option.key)}
              onChange={(checked) =>
                set(
                  'requiredFields',
                  checked ? [...values.requiredFields, option.key] : values.requiredFields.filter((f) => f !== option.key),
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-800">Report builder</h2>
        <p className="mb-4 text-sm text-ink-500">Choose what appears in generated PDFs.</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {REPORT_SECTION_OPTIONS.map((option) => (
            <Toggle
              key={option.key}
              label={option.label}
              checked={values.reportSections[option.key] ?? false}
              onChange={(checked) => set('reportSections', { ...values.reportSections, [option.key]: checked })}
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-base font-semibold text-ink-800">AI assistance</h2>
        <p className="mb-4 text-sm text-ink-500">
          {aiConfigured
            ? 'An AI key is configured on the server. The assistant only rewrites what a member typed — it never adds facts.'
            : 'No AI key is configured on the server, so AI buttons stay hidden regardless of this setting.'}
        </p>
        <Toggle
          label="Offer AI help to board members"
          description="Improve description, suggest beneficiary groups, draft period summaries."
          checked={values.aiEnabled}
          onChange={(v) => set('aiEnabled', v)}
        />
      </section>

      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button type="submit" loading={pending} size="lg">
          <Save className="h-4 w-4" /> Save settings
        </Button>
      </div>
    </form>
  );
}
