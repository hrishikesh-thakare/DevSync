import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToastStore } from '@/store/toastStore';

/**
 * §8 Danger Zone: "Type-to-confirm | Input where the user types the object's
 * actual name (not a generic 'DELETE'); the button stays disabled until it
 * matches."
 *
 * Split out and keyed on the phrase at the call site, so a new confirm mounts a
 * fresh empty field. That is what replaces resetting state from an effect.
 */
function ConfirmPhraseField({
  phrase,
  value,
  onChange,
}: {
  phrase: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-2">
      <Label htmlFor="confirm-phrase">
        Type <span className="font-mono text-foreground">{phrase}</span> to confirm
      </Label>
      <Input
        id="confirm-phrase"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={phrase}
        autoComplete="off"
      />
    </div>
  );
}

/**
 * App-level toast + confirm host. AGENTS.md §2 names this file as the toast
 * implementation — there is no Sonner here and none is wanted.
 */
export const ToastProvider = () => {
  const confirmState = useToastStore((s) => s.confirmState);
  const resolveConfirm = useToastStore((s) => s.resolveConfirm);
  const [typed, setTyped] = useState('');

  const phrase = confirmState?.confirmPhrase;
  const canConfirm = !phrase || typed === phrase;

  return (
    <>
      <Toaster />
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

          {phrase && (
            <ConfirmPhraseField key={phrase} phrase={phrase} value={typed} onChange={setTyped} />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => resolveConfirm(false)}>
              {confirmState?.cancelText}
            </AlertDialogCancel>
            <Button
              variant={confirmState?.isDestructive ? 'destructive' : 'primary'}
              disabled={!canConfirm}
              onClick={() => {
                resolveConfirm(true);
                setTyped('');
              }}
            >
              {confirmState?.confirmText}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
