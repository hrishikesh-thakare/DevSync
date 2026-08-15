import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  isDestructive: boolean;
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

export const useToastStore = create<ToastStoreState>((set, get) => ({
  toasts: [],
  confirmState: null,
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    
    // Auto remove
    const duration = toast.duration || 4000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  showConfirm: (options) => {
    return new Promise((resolve) => {
      set({
        confirmState: {
          ...options,
          isOpen: true,
          resolve,
        },
      });
    });
  },
  resolveConfirm: (value: boolean) => {
    const { confirmState } = get();
    if (confirmState) {
      confirmState.resolve(value);
      set({ confirmState: null });
    }
  },
}));
