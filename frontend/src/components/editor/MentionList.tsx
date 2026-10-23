import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { HashIcon } from 'lucide-react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initialsOf } from '@/lib/initials';
import type { MentionItem } from '@/components/editor/mentionSuggestion';

interface MentionListProps {
  items: MentionItem[];
  loading: boolean;
  command: (item: MentionItem) => void;
  clientRect?: () => DOMRect | null;
}

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const itemValue = (item: MentionItem) => `${item.kind}:${item.id}`;

/**
 * The `@` suggestion popup
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { items, loading, command, clientRect },
  ref,
) {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const virtualRef = useRef({
    getBoundingClientRect: () => clientRect?.() || new DOMRect(0, 0, 0, 0),
  });

  useEffect(() => {
    virtualRef.current.getBoundingClientRect = () => clientRect?.() || new DOMRect(0, 0, 0, 0);
  }, [clientRect]);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  // Keep the selected item scrolled into view when navigating via arrow keys
  useEffect(() => {
    if (!listRef.current) return;
    const itemEls = listRef.current.querySelectorAll('[data-slot="command-item"]');
    const selectedEl = itemEls[selected] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selected]);

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
    <Popover open={true}>
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
        className="w-80 p-0 overflow-hidden shadow-xl border bg-popover rounded-2xl"
        align="start"
      >
        <Command
          data-testid="mention-list"
          shouldFilter={false}
          value={items[selected] ? itemValue(items[selected]) : undefined}
          className="border-none bg-transparent"
        >
          <CommandList
            ref={listRef}
            onWheel={(e) => e.stopPropagation()}
            className="max-h-64 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground overscroll-contain p-1"
          >
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
                        onMouseDown={(e) => e.preventDefault()}
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
                        onMouseDown={(e) => e.preventDefault()}
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
