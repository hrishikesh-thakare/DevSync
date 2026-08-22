import { useToastStore } from '../store/toastStore';

interface ToastOptions {
  /** §8 Toasts: 13px body line under the title. */
  description?: string;
  /** Milliseconds, or `null` to persist until dismissed. Errors persist by default. */
  duration?: number | null;
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

export const useToast = (): ToastApi => {
  const addToast = useToastStore((s) => s.addToast);

  const emit = (type: 'success' | 'error' | 'warning' | 'info') =>
    (message: string, options?: ToastOptions) =>
      addToast({
        type,
        message,
        description: options?.description,
        duration: options?.duration,
      });

  return {
    success: emit('success'),
    error: emit('error'),
    warning: emit('warning'),
    info: emit('info'),
  };
};
