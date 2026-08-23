import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { FolderKanbanIcon, SettingsIcon, LogOutIcon } from 'lucide-react';
import { useAuthStore } from '@/store/auth';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95">
        <Command label="Global Command Menu" shouldFilter={true}>
          <Command.Input
            autoFocus
            placeholder="Type a command or search..."
            className="flex h-14 w-full rounded-md bg-transparent px-4 py-3 text-base outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden border-t p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            
            <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:rounded-sm [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2 [&_[cmdk-item]]:text-sm aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/workspaces'))}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground cursor-pointer"
              >
                <FolderKanbanIcon className="h-4 w-4" />
                <span>Workspaces</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/account'))}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground cursor-pointer"
              >
                <SettingsIcon className="h-4 w-4" />
                <span>Account Settings</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Actions" className="mt-4 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
              <Command.Item
                onSelect={() => runCommand(() => { logout(); navigate('/login'); })}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground cursor-pointer text-destructive data-[selected=true]:text-destructive"
              >
                <LogOutIcon className="h-4 w-4" />
                <span>Log out</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
