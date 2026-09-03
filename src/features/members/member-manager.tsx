'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Pencil, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
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
  rotaractId: string | null;
  role: Role;
  isActive: boolean;
  image: string | null;
  avenueId: string | null;
  boardPositionId: string | null;
  boardPosition: { title: string } | null;
  _count?: { createdEvents: number };
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

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
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_OPTIONS)[number]['value']>('ALL');
  const [roleFilter, setRoleFilter] = React.useState<Role | 'ALL'>('ALL');
  const [positionFilter, setPositionFilter] = React.useState<string>('ALL');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      if (statusFilter === 'ACTIVE' && !m.isActive) return false;
      if (statusFilter === 'INACTIVE' && m.isActive) return false;
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
      if (positionFilter !== 'ALL' && m.boardPositionId !== positionFilter) return false;
      return true;
    });
  }, [members, search, statusFilter, roleFilter, positionFilter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search members"
          />
        </div>
        <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as never)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as never)}>
          <option value="ALL">All roles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by board position" value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
          <option value="ALL">All board positions</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {filtered.length} of {members.length} member{members.length === 1 ? '' : 's'}
        </p>
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
        <table className="w-full min-w-[820px] text-left text-sm">
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
            {filtered.map((member) => (
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">
                  No members match these filters.
                </td>
              </tr>
            ) : null}
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
    rotaractId: member?.rotaractId ?? '',
    role: (member?.role ?? 'BOARD_MEMBER') as Role,
    boardPositionId: member?.boardPositionId ?? '',
    avenueId: member?.avenueId ?? '',
    isActive: member?.isActive ?? true,
    password: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(member?.image ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof values, value: unknown) => setValues((c) => ({ ...c, [key]: value }));

  async function uploadPhoto(memberId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/members/${memberId}/photo`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) {
      toast.error('Photo not saved', data.error ?? 'The member was saved, but the photo upload failed.');
    }
  }

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await upsertMemberAction(member?.id ?? null, values);
        if (!result.ok) {
          setPending(false);
          setErrors(result.fieldErrors ?? {});
          toast.error('Member not saved', result.message);
          return;
        }
        if (photoFile && result.data?.id) {
          await uploadPhoto(result.data.id, photoFile);
        }
        setPending(false);
        toast.success(result.message ?? 'Saved');
        onDone();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-800">{member ? `Edit ${member.name}` : 'Add a member'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative"
          aria-label="Upload profile photo"
        >
          <Avatar name={values.name || 'New member'} src={photoPreview} size={56} />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition group-hover:bg-brand-700">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <div className="text-xs text-ink-500">
          <p className="font-medium text-ink-700">Profile photo (optional)</p>
          <p>JPG, PNG or WEBP.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name}>
          {(props) => <Input {...props} value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Rtr. Name" />}
        </Field>
        <Field label="Email" required error={errors.email} hint="This is also their Google sign-in address.">
          {(props) => <Input {...props} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="Designation" required error={errors.boardPositionId} hint="Their board position or title in the club.">
          {(props) => (
            <Select {...props} value={values.boardPositionId} onChange={(e) => set('boardPositionId', e.target.value)}>
              <option value="" disabled>
                Select a designation…
              </option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          )}
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
        <Field label="Phone" optional>
          {(props) => <Input {...props} value={values.phone} onChange={(e) => set('phone', e.target.value)} />}
        </Field>
        <Field label="Rotaract ID" optional>
          {(props) => <Input {...props} value={values.rotaractId} onChange={(e) => set('rotaractId', e.target.value)} />}
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
