import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/session';
import { isGoogleEnabled } from '@/auth';
import { getClubSettings } from '@/server/settings';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  const { error, callbackUrl } = await searchParams;
  const settings = await getClubSettings().catch(() => null);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">R</span>
            <div>
              <p className="text-sm font-semibold text-ink-800">{settings?.clubName ?? 'Rotaract Club'}</p>
              <p className="text-xs text-ink-500">Event Reporting CRM</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-ink-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-500">Sign in to report an event or review submissions.</p>

          <LoginForm googleEnabled={isGoogleEnabled} error={error} callbackUrl={callbackUrl} />

          <p className="mt-8 text-xs leading-relaxed text-ink-400">
            Access is limited to board members added by an administrator. If you cannot sign in, ask your club Secretary to
            add your email address.
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 lg:block">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <blockquote className="max-w-md text-2xl font-medium leading-snug">
            “Answer a few questions, add your photos, and the report writes itself.”
          </blockquote>
          <p className="mt-4 text-sm text-brand-100">
            No PDFs to design. No Drive folders to create. Every number is stored so monthly and annual reports come out in
            one click.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm">
            {[
              ['5–10 min', 'to file a report'],
              ['1 click', 'monthly report'],
              ['0', 'folders to create'],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold">{value}</dt>
                <dd className="mt-1 text-brand-100">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
