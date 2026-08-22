import { useToastStore } from '../store/toastStore.js';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  /**
   * §8 Danger Zone: "Destructive actions that cannot be undone require
   * type-to-confirm." Pass the object's REAL name — §17 rules out a generic
   * "DELETE" or a product-wide constant.
   */
  confirmPhrase?: string;
}

export const useConfirm = () => {
  const showConfirm = useToastStore((state) => state.showConfirm);

  return (options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;

    return showConfirm({
      title: opts.title || 'Confirm',
      message: opts.message,
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      isDestructive: opts.isDestructive || false,
      confirmPhrase: opts.confirmPhrase,
    });
  };
};
