import React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { useToastStore } from '../../store/toastStore.js';

/**
 * App-level toast + confirm host. Lives here rather than in `components/ui/`
 * because it reads application state (`toastStore`) and composes primitives —
 * `ui/` holds only vendored shadcn primitives, which `npx shadcn add` may
 * regenerate at any time. There is one toast system: sonner's `<Toaster>`.
 */
export const ToastProvider: React.FC = () => {
  const confirmState = useToastStore((s) => s.confirmState);
  const resolveConfirm = useToastStore((s) => s.resolveConfirm);

  return (
    <>
      <Toaster richColors closeButton position="bottom-right" />
      <AlertDialog
        open={!!confirmState}
        onOpenChange={(open) => {
          if (!open) resolveConfirm(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>
              {confirmState?.cancelText}
            </AlertDialogCancel>
            <Button
              variant={confirmState?.isDestructive ? 'destructive' : 'default'}
              onClick={() => resolveConfirm(true)}
            >
              {confirmState?.confirmText}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
