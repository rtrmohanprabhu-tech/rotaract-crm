'use client';

import * as React from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; title: string; description?: string };

const ToastContext = React.createContext<{
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const counter = React.useRef(0);

  const push = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++counter.current;
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), toast.kind === 'error' ? 8000 : 4500);
  }, []);

  const value = React.useMemo(
    () => ({
      push,
      success: (title: string, description?: string) => push({ kind: 'success', title, description }),
      error: (title: string, description?: string) => push({ kind: 'error', title, description }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-4 sm:top-4 sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto w-full max-w-sm animate-fade-in rounded-xl border bg-white p-3.5 shadow-pop',
              toast.kind === 'success' && 'border-emerald-200',
              toast.kind === 'error' && 'border-red-200',
              toast.kind === 'info' && 'border-ink-200',
            )}
          >
            <div className="flex items-start gap-3">
              {toast.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : null}
              {toast.kind === 'error' ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /> : null}
              {toast.kind === 'info' ? <Info className="mt-0.5 h-5 w-5 shrink-0 text-azure-600" /> : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-800">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-sm text-ink-600">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="rounded-md p-1 text-ink-400 hover:bg-ink-100"
                onClick={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
