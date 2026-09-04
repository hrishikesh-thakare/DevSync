import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

const SHORTCUTS = [
  {
    category: 'Global',
    items: [
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: [isMac ? '⌘' : 'Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['f'], description: 'Focus search bar' },
    ],
  },
  {
    category: 'Projects',
    items: [
      { keys: ['c'], description: 'Create new task (when inside a project)' },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
      ) {
        return;
      }
      
      // Shift + / is ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Navigate and take action faster.</DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 grid gap-6">
          {SHORTCUTS.map((section) => (
            <div key={section.category}>
              <h3 className="mb-3 text-sm font-medium text-foreground">{section.category}</h3>
              <ul className="grid gap-2">
                {section.items.map((shortcut, i) => (
                  <li key={i} className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-[11px] font-medium text-muted-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
