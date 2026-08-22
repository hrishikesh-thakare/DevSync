import { useToastStore } from '../store/toastStore';

interface ToastOptions {
  description?: string;
  duration?: number;
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

export const useToast = (): ToastApi => {
  const addToast = useToastStore((s) => s.addToast);
  
  return {
    success: (message, options) => addToast({ type: 'success', message, duration: options?.duration }),
    error: (message, options) => addToast({ type: 'error', message, duration: options?.duration }),
    info: (message, options) => addToast({ type: 'info', message, duration: options?.duration }),
  };
};