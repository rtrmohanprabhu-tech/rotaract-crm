'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, KeyRound, Pencil, Plus, Search, UserCheck, UserX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Toggle } from '@/components/ui/field';
import { Avatar } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS } from '@/lib/constants';
import {
  createLoginForRosterMemberAction,
  setMemberActiveAction,
  setRosterMemberActiveAction,
  upsertMemberAction,
  upsertRosterMemberAction,
} from '@/server/actions/admin';
import type { MemberRow } from '@/server/roster';
import type { Role } from '@/generated/prisma/enums';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
] as const;

type ModalState =
  | { kind: 'roster-form'; row?: MemberRow }
  | { kind: 'user-form'; row: MemberRow }
  | { kind: 'create-login'; row: MemberRow }
  | null;

export function MemberManager({
  rows,
  positions,
  currentUserId,
}: {
  rows: MemberRow[];
  positions: Array<{ id: string; title: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = React.useState<ModalState>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<(typeof STATUS_OPTIONS)[number]['value']>('ALL');
  const [roleFilter, setRoleFilter] = React.useState<Role | 'ALL'>('ALL');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.email ?? ''} ${r.portfolio ?? ''}`.toLowerCase().includes(q)) return false;
      if (statusFilter === 'ACTIVE' && !r.isActive) return false;
      if (statusFilter === 'INACTIVE' && r.isActive) return false;
      if (roleFilter !== 'ALL' && r.role !== roleFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter, roleFilter]);

  function close() {
    setModal(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or portfolio…"
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
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">
          {filtered.length} of {rows.length} member{rows.length === 1 ? '' : 's'}
        </p>
        <Button onClick={() => setModal({ kind: 'roster-form' })}>
          <Plus className="h-4 w-4" /> Add member
        </Button>
      </div>

      {modal?.kind === 'roster-form' ? (
        <RosterForm row={modal.row} onDone={close} onCancel={() => setModal(null)} />
      ) : modal?.kind === 'user-form' ? (
        <StandaloneUserForm row={modal.row} positions={positions} onDone={close} onCancel={() => setModal(null)} />
      ) : modal?.kind === 'create-login' ? (
        <CreateLoginForm row={modal.row} onDone={close} onCancel={() => setModal(null)} />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Portfolio</th>
              <th className="px-4 py-3 font-medium">System Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.map((row) => (
              <tr key={`${row.kind}-${row.id}`} className={row.isActive ? '' : 'opacity-60'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={row.name} src={row.image} size={34} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-800">{row.name}</p>
                      <p className="truncate text-xs text-ink-500">{row.email ?? 'No login yet'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-600">{row.portfolio ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-ink-600">{ROLE_LABELS[row.role as Role]}</span>
                  {!row.hasLogin ? <span className="ml-1.5 text-xs text-ink-400">(pending login)</span> : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {row.kind === 'roster' && !row.hasLogin ? (
                      <button
                        type="button"
                        aria-label={`Create login for ${row.name}`}
                        title="Create login"
                        onClick={() => setModal({ kind: 'create-login', row })}
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => setModal(row.kind === 'roster' ? { kind: 'roster-form', row } : { kind: 'user-form', row })}
                      className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {row.userId !== currentUserId ? (
                      <button
                        type="button"
                        aria-label={row.isActive ? `Deactivate ${row.name}` : `Reactivate ${row.name}`}
                        onClick={async () => {
                          const result =
                            row.kind === 'roster'
                              ? await setRosterMemberActiveAction(row.id, !row.isActive)
                              : await setMemberActiveAction(row.id, !row.isActive);
                          toast[result.ok ? 'success' : 'error'](result.message ?? '');
                          router.refresh();
                        }}
                        className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                      >
                        {row.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">
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

/** Add/edit a roster entry — name, portfolio, system role. No email, no password. */
function RosterForm({ row, onDone, onCancel }: { row?: MemberRow; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [values, setValues] = React.useState({
    name: row?.name ?? '',
    portfolio: row?.portfolio ?? '',
    intendedRole: (row?.role ?? 'BOARD_MEMBER') as Role,
    isActive: row?.isActive ?? true,
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
        const result = await upsertRosterMemberAction(row?.kind === 'roster' ? row.id : null, values);
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
        <h3 className="text-base font-semibold text-ink-800">{row ? `Edit ${row.name}` : 'Add a member'}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!row ? (
        <p className="text-xs text-ink-500">
          Add them to the roster first — no email needed yet. Once they're ready to sign in, use{' '}
          <strong>Create login</strong> from the table.
        </p>
      ) : row.hasLogin ? (
        <p className="text-xs text-ink-500">
          {row.name} already has a login ({row.email}) — System Role here updates their real permissions immediately.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name}>
          {(props) => <Input {...props} value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="Rtr. Name" />}
        </Field>
        <Field label="Portfolio" optional hint="Their Rotaract designation, e.g. Web Service Chair.">
          {(props) => <Input {...props} value={values.portfolio} onChange={(e) => set('portfolio', e.target.value)} />}
        </Field>
        <Field label="System role" required hint="Controls what they can do once they have a login.">
          {(props) => (
            <Select {...props} value={values.intendedRole} onChange={(e) => set('intendedRole', e.target.value as Role)}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Toggle
        checked={values.isActive}
        onChange={(v) => set('isActive', v)}
        label="Active"
        description={
          row?.hasLogin
            ? 'Inactive members cannot sign in, but their past reports stay intact.'
            : "This only matters once they have a login — it's who to show as active on the roster until then."
        }
      />

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {row ? 'Save member' : 'Add member'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Give an existing roster entry its first login — the only place their email is ever collected. */
function CreateLoginForm({ row, onDone, onCancel }: { row: MemberRow; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await createLoginForRosterMemberAction(row.id, { email, password });
        setPending(false);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error('Login not created', result.message);
          return;
        }
        toast.success(result.message ?? 'Login created');
        onDone();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-800">Create a login for {row.name}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-500">
        Role: <strong>{ROLE_LABELS[row.role as Role]}</strong> · Portfolio: <strong>{row.portfolio ?? '—'}</strong>. Change
        either from Edit first if needed.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" required error={errors.email} hint="This is also their Google sign-in address.">
          {(props) => <Input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" optional error={errors.password} hint="Leave blank if they will sign in with Google.">
          {(props) => (
            <Input {...props} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          )}
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Create login
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Full editor for legacy standalone User rows (not on the roster) — unchanged from before. */
function StandaloneUserForm({
  row,
  positions,
  onDone,
  onCancel,
}: {
  row: MemberRow;
  positions: Array<{ id: string; title: string }>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = React.useState({
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? '',
    rotaractId: row.rotaractId ?? '',
    role: row.role as Role,
    boardPositionId: row.boardPositionId ?? '',
    avenueId: row.avenueId ?? '',
    isActive: row.isActive,
    password: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(row.image ?? null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const set = (key: keyof typeof values, value: unknown) => setValues((c) => ({ ...c, [key]: value }));

  async function uploadPhoto(userId: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/members/${userId}/photo`, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) toast.error('Photo not saved', data.error ?? 'The member was saved, but the photo upload failed.');
  }

  return (
    <form
      className="card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const result = await upsertMemberAction(row.id, values);
        if (!result.ok) {
          setPending(false);
          setErrors(result.fieldErrors ?? {});
          toast.error('Member not saved', result.message);
          return;
        }
        if (photoFile && result.data?.id) await uploadPhoto(result.data.id, photoFile);
        setPending(false);
        toast.success(result.message ?? 'Saved');
        onDone();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink-800">Edit {row.name}</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-ink-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-500">This account isn't on the official roster — editing here only changes the login record.</p>

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative" aria-label="Upload profile photo">
          <Avatar name={values.name || 'Member'} src={photoPreview} size={56} />
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
          {(props) => <Input {...props} value={values.name} onChange={(e) => set('name', e.target.value)} />}
        </Field>
        <Field label="Email" required error={errors.email}>
          {(props) => <Input {...props} type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />}
        </Field>
        <Field label="Designation" required error={errors.boardPositionId}>
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
        <Field label="Set a new password" optional error={errors.password} hint="Leave blank if they will sign in with Google.">
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
          Save member
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
