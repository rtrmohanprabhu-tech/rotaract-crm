'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, UserCheck, UserX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Toggle } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS } from '@/lib/constants';
import { setMemberActiveAction, upsertMemberAction } from '@/server/actions/admin';
import type { Role } from '@/generated/prisma/enums';

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  image: string | null;
  avenueId: string | null;
  boardPositionId: string | null;
  boardPosition: { title: string } | null;
  _count?: { createdEvents: number };
};

export function MemberManager({
  members,
  avenues,
  positions,
  currentUserId,
}: {
  members: MemberRow[];
  avenues: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = React.useState<MemberRow | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add member
        </Button>
      </div>

      {editing ? (
        <MemberForm
          member={editing === 'new' ? undefined : editing}
          avenues={avenues}
          positions={positions}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Board position</th>
              <th className="px-4 py-3 font-medium">Avenue</th>
              <th className="px-4 py-3 text-right font-medium">Events</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {members.map((member) => (
              <tr key={member.id} className={member.isActive ? '' : 'opacity-60'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} src={member.image} size={34} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-800">{member.name}</p>
                      <p className="truncate text-xs text-ink-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-600">{ROLE_LABELS[member.role]}</td>
                <td className="px-4 py-3 text-ink-600">{member.boardPosition?.title ?? '—'}</td>
                <td className="px-4 py-3 text-ink-600">{avenues.find((a) => a.id === member.avenueId)?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-600">{member._count?.createdEvents ?? 0}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      member.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      aria-label={`Edit ${member.name}`}
                      onClick={() => setEditing(member)}
                      className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {member.id !== currentUserId ? (
                      <button
                        type="button"
                        aria-label={member.isActive ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}
                        onClick={async () => {
                          const result = await setMemberActiveAction(member.id, !member.isActive);
                          toast[result.ok ? 'success' : 'error'](result.message ?? '');
                          router.refresh();
                        }}
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      >
                        {member.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberForm({
  member,
  avenues,
  positions,
  onDone,
  onCancel,
}: {
  member?: MemberRow;
  avenues: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; title: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = React.useState({
    name: member?.name ?? '',
    email: member?.email ?? '',
    phone: member?.phone ?? '',
    role: (member?.role ?? 'BOARD_MEMBER') as Role,
    boardPositionId: member?.boardPositionId ?? '',
    avenueId: member?.avenueId ?? '',
    isActive: member?.isActive ?? true,
    password: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  const set = (key: keyof typeof values, value: unknown) => setValues((c) => ({ ...c, [key]: value }));

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await upsertMemberAction(member?.id ?? null, values);
        setPending(false);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error('Member not saved', result.message);
          return;
        }
        toast.success(result.message ?? 'Saved');
        onDone();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-800">{member ? `Edit ${member.name}` : 'Add a board member'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name}>
          {(props) => <Input {...props} value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Rtr. Name" />}
        </Field>
        <Field label="Email" required error={errors.email} hint="This is also their Google sign-in address.">
          {(props) => <Input {...props} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="Phone" optional>
          {(props) => <Input {...props} value={values.phone} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field label="Role" required>
          {(props) => (
            <Select {...props} value={values.role} onChange={(e) => set('role', e.target.value as Role)}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Board position" optional>
          {(props) => (
            <Select {...props} value={values.boardPositionId} onChange={(e) => set('boardPositionId', e.target.value)}>
              <option value="">None</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Avenue (for directors)" optional hint="Directors review the reports filed under their avenue.">
          {(props) => (
            <Select {...props} value={values.avenueId} onChange={(e) => set('avenueId', e.target.value)}>
              <option value="">None</option>
              {avenues.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label={member ? 'Set a new password' : 'Password'}
          optional
          error={errors.password}
          hint="Leave blank if they will sign in with Google."
        >
          {(props) => (
            <Input {...props} type="password" value={values.password} onChange={(e) => set('password', e.target.value)} autoComplete="new-password" />
          )}
        </Field>
      </div>

      <Toggle
        checked={values.isActive}
        onChange={(v) => set('isActive', v)}
        label="Active"
        description="Inactive members cannot sign in, but their past reports stay intact."
      />

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {member ? 'Save member' : 'Add member'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
