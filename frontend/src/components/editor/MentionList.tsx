import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { HashIcon } from 'lucide-react';

import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/initials';
import type { MentionItem } from '@/components/editor/mentionSuggestion';

interface MentionListProps {
  items: MentionItem[];
  loading: boolean;
  command: (item: MentionItem) => void;
}

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const itemValue = (item: MentionItem) => `${item.kind}:${item.id}`;

/**
 * The `@` suggestion popup — rendered via `ReactRenderer` from
 * `mentionSuggestion.tsx`, not mounted directly by any page.
 *
 * Positioning is entirely Tiptap Suggestion's own `props.mount()` (see the
 * render() in mentionSuggestion.tsx) — this component renders a plain
 * floating box with no opinion on where it sits. Deliberately NOT a Radix
 * `Popover`/`PopoverAnchor` with a `virtualRef`: that was tried and it does
 * not track a *sibling* layout shift (an image or video elsewhere in the
 * message list finishing its async load and pushing the composer down) —
 * Radix's own positioning only reacts to its own anchor/content resizing and
 * ordinary scroll/window-resize, not an arbitrary reflow elsewhere in the
 * page. `props.mount()` is backed by Floating UI's `autoUpdate`, which
 * watches exactly that case (ResizeObserver on the reference *and* the
 * floating element, plus scroll listeners on every scrollable ancestor) —
 * it is the built-in, load-bearing reason to prefer it over a hand-rolled
 * position.
 *
 * `Command`/`CommandList` (the same primitives `CommandPalette.tsx` uses)
 * over a hand-rolled scrollable `<ul>` — confirmed live that a plain
 * `max-h-* overflow-y-auto` div silently failed to clip a list longer than a
 * few items, while `CommandList` just works. Its own keyboard handling is
 * unused, though: Tiptap's suggestion plugin captures arrow keys/Enter at
 * the editor level before they reach this component's DOM, so navigation
 * stays driven by `selected` state here, fed to `Command` as a controlled
 * `value` purely for highlighting and scroll-into-view.
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { items, loading, command },
  ref,
) {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setSelected((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setSelected((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  const users = items.filter((i) => i.kind === 'user');
  const tasks = items.filter((i) => i.kind === 'task');

  return (
    <Command
      data-testid="mention-list"
      shouldFilter={false}
      value={items[selected] ? itemValue(items[selected]) : undefined}
      className="w-72 rounded-lg border bg-popover text-popover-foreground shadow-md"
    >
      <CommandList className="overflow-hidden">
        <ScrollArea className="max-h-72">
          {loading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Searching…</p>
          ) : items.length === 0 ? (
            <CommandEmpty>No matches.</CommandEmpty>
          ) : (
            <>
              {users.length > 0 ? (
                <CommandGroup heading="People">
                  {users.map((item) => (
                    <CommandItem
                      key={itemValue(item)}
                      value={itemValue(item)}
                      onSelect={() => command(item)}
                      onMouseEnter={() => setSelected(items.indexOf(item))}
                    >
                      <Avatar className="size-5 shrink-0">
                        <AvatarImage src={item.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback className="text-[10px]">{initialsOf(item.label)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {tasks.length > 0 ? (
                <CommandGroup heading="Tasks">
                  {tasks.map((item) => (
                    <CommandItem
                      key={itemValue(item)}
                      value={itemValue(item)}
                      onSelect={() => command(item)}
                      onMouseEnter={() => setSelected(items.indexOf(item))}
                    >
                      <HashIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <code className="shrink-0 font-mono text-xs text-muted-foreground">{item.taskKey}</code>
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </>
          )}
        </ScrollArea>
      </CommandList>
    </Command>
  );
});
