'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

const ERRORS: Record<string, string> = {
  not_a_member: 'That Google account is not on the club roster yet. Ask an admin to add your email first.',
  inactive: 'Your account has been deactivated. Contact your club Secretary.',
  CredentialsSignin: 'Email or password is incorrect.',
  OAuthAccountNotLinked: 'That email is already registered with a different sign-in method.',
  default: 'We could not sign you in. Please try again.',
};

export function LoginForm({
  googleEnabled,
  error,
  callbackUrl,
}: {
  googleEnabled: boolean;
  error?: string;
  callbackUrl?: string;
}) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(error ? (ERRORS[error] ?? ERRORS.default) : null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: callbackUrl || '/dashboard',
    });
    if (res?.error) {
      setFormError(ERRORS.CredentialsSignin);
      setPending(false);
      return;
    }
    window.location.href = res?.url ?? '/dashboard';
  }

  return (
    <div className="mt-8">
      {formError ? (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      {googleEnabled ? (
        <>
          <Button
            type="button"
            variant="secondary"
            block
            size="lg"
            onClick={() => signIn('google', { callbackUrl: callbackUrl || '/dashboard' })}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
            </svg>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-400">
            <span className="h-px flex-1 bg-ink-200" /> or use your email <span className="h-px flex-1 bg-ink-200" />
          </div>
        </>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email">
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@club.org"
            />
          )}
        </Field>
        <Field label="Password">
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          )}
        </Field>
        <Button type="submit" block size="lg" loading={pending}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
