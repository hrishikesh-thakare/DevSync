import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Modal focus management, written by hand because no primitives library is
 * installed (AGENTS.md §2: "build interaction/accessibility behavior — focus
 * trap, keyboard nav, portal rendering — explicitly").
 *
 * While `active`:
 *   - focus moves into the panel (first focusable, else the panel itself),
 *   - Tab and Shift+Tab cycle inside it rather than escaping to the page,
 *   - the document behind is locked from scrolling.
 *
 * On deactivate, focus returns to whatever was focused when the trap opened —
 * §18's "Closing any Dialog/Drawer/Dropdown returns focus to the triggering
 * element". The return is also run on unmount, so a caller that renders the
 * dialog conditionally (`{open && <Dialog/>}`) still restores focus.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const node = ref.current;

    if (node) {
      const first = focusableWithin(node)[0];
      if (first) {
        first.focus();
      } else {
        node.setAttribute('tabindex', '-1');
        node.focus();
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !ref.current) return;
      const items = focusableWithin(ref.current);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (current === first || !ref.current.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [active]);

  return ref;
}
