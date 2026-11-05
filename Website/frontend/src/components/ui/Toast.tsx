"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  // Show a transient message. Returns nothing — toasts are fire-and-forget.
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const VISIBLE_MS = 2600;
const MAX_VISIBLE = 3;

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-slate-200 bg-white text-slate-700',
};

const TONE_ICON: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: 'i',
};

// Lightweight toast host. Deliberately dependency-free: it reuses the existing
// Tailwind tokens (shadow-card, animate-fade-in, brand colours) so notifications
// match the rest of the UI and add no bundle weight.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Track timers so unmounting never leaves a setTimeout writing to dead state.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      // Cap the stack so a burst of actions can't cover the screen.
      setToasts((list) => [...list, { id, message, tone }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), VISIBLE_MS)
      );
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live so screen readers announce each toast without stealing focus. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`animate-fade-in pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-card ${TONE_STYLES[t.tone]}`}
          >
            <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/70 text-xs font-bold">
              {TONE_ICON[t.tone]}
            </span>
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="ml-1 shrink-0 rounded px-1 text-base leading-none opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Access the toast API. Returns a no-op outside the provider so a component can
// be rendered in isolation (tests, Storybook) without crashing.
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP_TOAST;
}

const NOOP_TOAST: ToastApi = { toast: () => {} };
