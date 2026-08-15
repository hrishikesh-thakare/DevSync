import { useToastStore } from '../store/toastStore.js';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const useConfirm = () => {
  const showConfirm = useToastStore((state) => state.showConfirm);

  return (options: ConfirmOptions | string): Promise<boolean> => {
    if (typeof options === 'string') {
      return showConfirm({
        title: 'Confirm',
        message: options,
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        isDestructive: false,
      });
    }

    return showConfirm({
      title: options.title || 'Confirm',
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      isDestructive: options.isDestructive || false,
    });
  };
};
