import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOutIcon, SearchIcon, SettingsIcon, LayersIcon, UserCogIcon } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { WorkspaceBreadcrumbs } from '@/components/layout/WorkspaceBreadcrumbs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { initialsOf } from '@/lib/initials';

/**
 * Which modifier the palette hint should show. Read once at module load —
 * `navigator` is stable, and `userAgentData` is not available in every browser
 * so `platform` remains the reliable check despite being deprecated.
 */
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

export function WorkspaceTopBar({ slug }: { slug: string }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { members, isOwner } = useCurrentWorkspaceStore();

  // GET /auth/me returns only userId/email/fullName, so the avatar has to come
  // from the member roster — which does carry avatarUrl and presence.
  const me = members.find((m) => m.userId === user?.userId);
  const displayName = me?.displayName || me?.fullName || user?.fullName || user?.email || '';
  const avatarUrl = me?.avatarUrl ?? user?.avatarUrl ?? undefined;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 2) navigate(`/w/${slug}/search?q=${encodeURIComponent(q)}`);
  };

  const signOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input, textarea, or contenteditable
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
      ) {
        return;
      }
      
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <WorkspaceBreadcrumbs />

      <form onSubmit={onSearch} className="relative ml-auto max-w-md flex-1" role="search">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="global-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks and messages… (Press f)"
          aria-label="Search this workspace"
          className="pl-8 pr-14"
        />
        {/* The command palette was keyboard-only discovery — nothing in the UI
            hinted it existed. */}
        <kbd
          className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex"
          aria-hidden="true"
        >
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </form>

      <div className="flex items-center gap-1">
        <NotificationBell slug={slug} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <Avatar className="size-7">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-xs">{initialsOf(displayName)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account">
                <UserCogIcon className="size-4" aria-hidden="true" />
                Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/workspaces">
                <LayersIcon className="size-4" aria-hidden="true" />
                Switch workspace
              </Link>
            </DropdownMenuItem>
            {isOwner() ? (
              <DropdownMenuItem asChild>
                <Link to={`/w/${slug}/settings`}>
                  <SettingsIcon className="size-4" aria-hidden="true" />
                  Workspace settings
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOutIcon className="size-4" aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
