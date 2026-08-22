import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** §8 Toasts: "Body | 13px weight 400 `--text-secondary`". */
  description?: string;
  /** Milliseconds, or `null` to persist until dismissed. */
  duration?: number | null;
}

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDestructive: boolean;
  /** When set, the user must type this exact string before confirming (§8 Danger Zone). */
  confirmPhrase?: string;
  resolve: (value: boolean) => void;
}

interface ToastStoreState {
  toasts: Toast[];
  confirmState: ConfirmState | null;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  showConfirm: (options: Omit<ConfirmState, 'isOpen' | 'resolve'>) => Promise<boolean>;
  resolveConfirm: (value: boolean) => void;
}

/** §8 Toasts: "Duration | 4s default, indefinite for errors." */
const DEFAULT_DURATION = 4000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
let counter = 0;

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  confirmState: null,

  addToast: (toast) => {
    // Monotonic ids — `Math.random()` can collide, and a collision silently
    // dismisses the wrong toast.
    counter += 1;
    const id = `toast-${counter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

    // An error stays until the user dismisses it: it is the one kind of toast
    // that may carry something they need to act on.
    const duration =
      toast.duration === null
        ? null
        : (toast.duration ?? (toast.type === 'error' ? null : DEFAULT_DURATION));

    if (duration !== null) {
      timers.set(
        id,
        setTimeout(() => get().removeToast(id), duration),
      );
    }
  },

  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  showConfirm: (options) =>
    new Promise((resolve) => {
      set({ confirmState: { ...options, isOpen: true, resolve } });
    }),

  resolveConfirm: (value: boolean) => {
    const { confirmState } = get();
    if (confirmState) {
      confirmState.resolve(value);
      set({ confirmState: null });
    }
  },
}));
