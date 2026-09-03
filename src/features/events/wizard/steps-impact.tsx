'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { ChipGroup, Field, Input, Select, Textarea, YesNo } from '@/components/ui/field';
import { BENEFICIARY_LABELS, FUNDING_LABELS } from '@/lib/constants';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { StepProps } from './steps-details';

function NumberField({
  label,
  value,
  onChange,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  id?: string;
}) {
  return (
    <Field label={label} hint={hint} id={id}>
      {(props) => (
        <Input
          {...props}
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/^0+(?=\d)/, ''))}
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </Field>
  );
}

export function StepParticipation({ values, set }: StepProps) {
  const total =
    Number(values.rotaractorsPresent || 0) +
    Number(values.rotariansPresent || 0) +
    Number(values.councilPresent || 0) +
    Number(values.guestsPresent || 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-600">How many people took part? We add it up for you.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Rotaractors present" value={values.rotaractorsPresent} onChange={(v) => set('rotaractorsPresent', v)} />
        <NumberField label="Rotarians present" value={values.rotariansPresent} onChange={(v) => set('rotariansPresent', v)} />
        <NumberField label="Council / board members present" value={values.councilPresent} onChange={(v) => set('councilPresent', v)} />
        <NumberField label="Guests / others present" value={values.guestsPresent} onChange={(v) => set('guestsPresent', v)} />
      </div>

      <div className="flex items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Total participants</p>
          <p className="text-2xl font-semibold text-brand-800 tabular-nums">{formatNumber(total)}</p>
        </div>
      </div>
    </div>
  );
}

export function StepBeneficiaries({ values, set, errors }: StepProps) {
  const total = Number(values.directBeneficiaries || 0) + Number(values.indirectBeneficiaries || 0);

  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Who benefited from this event?</p>
        <p className="mb-3 text-xs text-ink-500">Pick every group that applies.</p>
        <ChipGroup
          options={Object.entries(BENEFICIARY_LABELS).map(([value, label]) => ({ value, label }))}
          value={values.beneficiaryCategories}
          onChange={(v) => set('beneficiaryCategories', v)}
        />
        {errors.beneficiaries ? <p className="mt-2 text-sm font-medium text-red-600">{errors.beneficiaries}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Direct beneficiaries"
          value={values.directBeneficiaries}
          onChange={(v) => set('directBeneficiaries', v)}
          hint="People who received something directly."
        />
        <NumberField
          label="Indirect beneficiaries"
          value={values.indirectBeneficiaries}
          onChange={(v) => set('indirectBeneficiaries', v)}
          hint="Families, classmates, the wider community."
        />
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Total beneficiaries</p>
        <p className="text-2xl font-semibold text-ink-800 tabular-nums">{formatNumber(total)}</p>
      </div>

      <Field label="Anything else about who benefited?" optional>
        {(props) => (
          <Textarea
            {...props}
            value={values.beneficiaryNotes}
            onChange={(e) => set('beneficiaryNotes', e.target.value)}
            placeholder="e.g. 60 students of the government school kitchen programme"
            className="min-h-[90px]"
          />
        )}
      </Field>
    </div>
  );
}

export function StepFinancials({ values, set, ctx, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Did this event involve any expenses?</p>
        <YesNo
          value={values.hasExpenses}
          name="Expenses"
          onChange={(v) => {
            set('hasExpenses', v);
            if (!v) {
              set('eventCost', '0');
              set('fundingSource', '');
              set('sponsorName', '');
            }
          }}
        />
      </div>

      {values.hasExpenses ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Total event cost (${ctx.settings.currency})`} required error={errors.eventCost}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={values.eventCost}
                  onChange={(e) => set('eventCost', e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                />
              )}
            </Field>
            <Field label="Funding source" required error={errors.fundingSource}>
              {(props) => (
                <Select {...props} value={values.fundingSource} onChange={(e) => set('fundingSource', e.target.value)}>
                  <option value="">Select…</option>
                  {Object.entries(FUNDING_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          {['SPONSOR', 'DONATION', 'PARTNER_ORGANIZATION'].includes(values.fundingSource) ? (
            <Field label="Sponsor / donor name" optional>
              {(props) => <Input {...props} value={values.sponsorName} onChange={(e) => set('sponsorName', e.target.value)} />}
            </Field>
          ) : null}

          <Field label="Expense notes" optional hint="Bills and invoices can be attached in the evidence step.">
            {(props) => (
              <Textarea
                {...props}
                value={values.expenseNotes}
                onChange={(e) => set('expenseNotes', e.target.value)}
                className="min-h-[90px]"
                placeholder="e.g. Mixer grinder ₹4,200 + transport ₹334"
              />
            )}
          </Field>

          <p className="text-sm text-ink-500">
            Recorded cost: <strong className="text-ink-800">{formatCurrency(Number(values.eventCost || 0), ctx.settings.currency)}</strong>
          </p>
        </>
      ) : (
        <p className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
          No expenses recorded — the report will show a cost of {formatCurrency(0, ctx.settings.currency)}.
        </p>
      )}
    </div>
  );
}
