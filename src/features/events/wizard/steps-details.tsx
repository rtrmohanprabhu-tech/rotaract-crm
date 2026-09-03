'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Field, Input, Select, YesNo } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { EVENT_TYPE_LABELS, ORG_TYPE_LABELS } from '@/lib/constants';
import { emptyCollaborator, type WizardContextData, type WizardValues } from './types';

export type StepProps = {
  values: WizardValues;
  set: <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => void;
  ctx: WizardContextData;
  errors: Record<string, string>;
};

export function StepBasics({ values, set, ctx, errors }: StepProps) {
  return (
    <div className="space-y-5">
      <Field label="Event name" required error={errors.eventName} hint="The name you would put on the poster.">
        {(props) => (
          <Input
            {...props}
            value={values.eventName}
            onChange={(e) => set('eventName', e.target.value)}
            placeholder="e.g. Care2Cook"
            autoFocus
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Event date" required error={errors.eventDate}>
          {(props) => <Input {...props} type="date" value={values.eventDate} onChange={(e) => set('eventDate', e.target.value)} />}
        </Field>
        <Field label="Start time" optional error={errors.startTime}>
          {(props) => <Input {...props} type="time" value={values.startTime} onChange={(e) => set('startTime', e.target.value)} />}
        </Field>
        <Field label="End time" optional error={errors.endTime}>
          {(props) => <Input {...props} type="time" value={values.endTime} onChange={(e) => set('endTime', e.target.value)} />}
        </Field>
      </div>

      <Field label="Avenue of service" required error={errors.avenueId}>
        {(props) => (
          <Select {...props} value={values.avenueId} onChange={(e) => set('avenueId', e.target.value)}>
            <option value="">Select an avenue…</option>
            {ctx.avenues.map((avenue) => (
              <option key={avenue.id} value={avenue.id}>
                {avenue.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div>
        <p className="field-label">How was it held?</p>
        <div className="grid grid-cols-3 gap-2">
          {(['PHYSICAL', 'ONLINE', 'HYBRID'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set('eventType', type)}
              aria-pressed={values.eventType === type}
              className={`h-11 rounded-xl border text-sm font-medium transition ${
                values.eventType === type
                  ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
              }`}
            >
              {EVENT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StepLeadership({ values, set, ctx, errors }: StepProps) {
  const memberOptions = (
    <>
      <option value="">Not recorded</option>
      {ctx.members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
          {member.position ? ` — ${member.position}` : ''}
        </option>
      ))}
    </>
  );

  return (
    <div className="space-y-5">
      <Field
        label="Event chair"
        required
        error={errors.chairId}
        hint="Pick from the club roster so their name is spelled the same in every report."
      >
        {(props) => (
          <Select {...props} value={values.chairId} onChange={(e) => set('chairId', e.target.value)}>
            {memberOptions}
          </Select>
        )}
      </Field>

      {!values.chairId ? (
        <Field label="…or type the chair's name" optional hint="Use this only if the chair is not yet a member in the system.">
          {(props) => (
            <Input
              {...props}
              value={values.chairNameText}
              onChange={(e) => set('chairNameText', e.target.value)}
              placeholder="Rtr. Name"
            />
          )}
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event secretary" optional>
          {(props) => (
            <Select {...props} value={values.secretaryId} onChange={(e) => set('secretaryId', e.target.value)}>
              {memberOptions}
            </Select>
          )}
        </Field>
        <Field label="Project lead / director" optional>
          {(props) => (
            <Select {...props} value={values.directorId} onChange={(e) => set('directorId', e.target.value)}>
              {memberOptions}
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}

export function StepVenue({ values, set, errors }: StepProps) {
  const online = values.eventType === 'ONLINE';
  const hybrid = values.eventType === 'HYBRID';

  return (
    <div className="space-y-5">
      {online || hybrid ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform" required={online} error={errors.platform} hint="Zoom, Google Meet, Instagram Live…">
            {(props) => <Input {...props} value={values.platform} onChange={(e) => set('platform', e.target.value)} placeholder="Google Meet" />}
          </Field>
          <Field label="Meeting link" optional error={errors.meetingLink}>
            {(props) => (
              <Input {...props} type="url" value={values.meetingLink} onChange={(e) => set('meetingLink', e.target.value)} placeholder="https://" />
            )}
          </Field>
        </div>
      ) : null}

      {!online ? (
        <>
          <Field label="Venue" required error={errors.venue} hint="Where did it actually happen?">
            {(props) => (
              <Input {...props} value={values.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Government Hospital, Coimbatore" />
            )}
          </Field>
          <Field label="Address" optional>
            {(props) => <Input {...props} value={values.address} onChange={(e) => set('address', e.target.value)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="City" optional>
              {(props) => <Input {...props} value={values.city} onChange={(e) => set('city', e.target.value)} />}
            </Field>
            <Field label="District" optional>
              {(props) => <Input {...props} value={values.district} onChange={(e) => set('district', e.target.value)} />}
            </Field>
            <Field label="State" optional>
              {(props) => <Input {...props} value={values.state} onChange={(e) => set('state', e.target.value)} />}
            </Field>
            <Field label="Country" optional>
              {(props) => <Input {...props} value={values.country} onChange={(e) => set('country', e.target.value)} />}
            </Field>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function StepCollaboration({ values, set, errors }: StepProps) {
  function updateCollaborator(index: number, patch: Partial<(typeof values.collaborators)[number]>) {
    set(
      'collaborators',
      values.collaborators.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="field-label">Was this event conducted with another organisation?</p>
        <YesNo
          value={values.isCollaboration}
          name="Collaboration"
          onChange={(v) => {
            set('isCollaboration', v);
            if (!v) {
              set('projectWith', 'SELF');
              set('collaborators', []);
            } else if (values.collaborators.length === 0) {
              set('collaborators', [{ ...emptyCollaborator }]);
            }
          }}
        />
        {!values.isCollaboration ? (
          <p className="hint">We&apos;ll record this as <strong>Project With: SELF</strong>.</p>
        ) : null}
      </div>

      {values.isCollaboration ? (
        <>
          {errors.collaborators ? <p className="text-sm font-medium text-red-600">{errors.collaborators}</p> : null}
          {values.collaborators.map((collaborator, index) => (
            <div key={index} className="space-y-4 rounded-2xl border border-ink-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-700">Partner {index + 1}</p>
                {values.collaborators.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => set('collaborators', values.collaborators.filter((_, i) => i !== index))}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove partner ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organisation type">
                  {(props) => (
                    <Select {...props} value={collaborator.orgType} onChange={(e) => updateCollaborator(index, { orgType: e.target.value })}>
                      {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Organisation name" required>
                  {(props) => (
                    <Input
                      {...props}
                      value={collaborator.orgName}
                      onChange={(e) => {
                        updateCollaborator(index, { orgName: e.target.value });
                        if (index === 0) set('projectWith', e.target.value || 'SELF');
                      }}
                      placeholder="e.g. Sri Sakthi Institute of Engineering and Technology"
                    />
                  )}
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Contact person" optional>
                  {(props) => <Input {...props} value={collaborator.contactName} onChange={(e) => updateCollaborator(index, { contactName: e.target.value })} />}
                </Field>
                <Field label="Contact email" optional>
                  {(props) => (
                    <Input {...props} type="email" value={collaborator.contactEmail} onChange={(e) => updateCollaborator(index, { contactEmail: e.target.value })} />
                  )}
                </Field>
                <Field label="Contact phone" optional>
                  {(props) => <Input {...props} value={collaborator.contactPhone} onChange={(e) => updateCollaborator(index, { contactPhone: e.target.value })} />}
                </Field>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => set('collaborators', [...values.collaborators, { ...emptyCollaborator }])}>
            <Plus className="h-4 w-4" /> Add another organisation
          </Button>
          <Field label="Project with (as it should appear in reports)" optional>
            {(props) => <Input {...props} value={values.projectWith} onChange={(e) => set('projectWith', e.target.value)} />}
          </Field>
        </>
      ) : null}
    </div>
  );
}
