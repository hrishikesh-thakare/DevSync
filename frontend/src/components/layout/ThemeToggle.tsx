import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/theme/ThemeProvider';
import { cn } from '@/lib/utils';

/**
 * Light/dark mode switch.
 *
 * `ThemeProvider` (mounted in `main.tsx`) owns the state — it writes `.dark` onto
 * `<html>` and persists the choice under `devsync-theme`. This is only the control.
 *
 * It is its own component because the app has three unrelated top bars — the
 * workspace shell in `WorkspaceLayout`, the workspace picker in `WorkspaceList`,
 * and the marketing nav on `LandingPage` — and no shared header to hang it off.
 * `TooltipProvider` is mounted at the root, so the tooltip works wherever this
 * is dropped in.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggle } = useTheme();
  const label = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          onClick={toggle}
          aria-label={label}
          variant="ghost"
          size="icon"
          className={cn(
            'size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-hover transition-colors',
            className,
          )}
        >
          {mode === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default ThemeToggle;
