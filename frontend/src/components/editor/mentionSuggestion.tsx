import { ReactRenderer } from '@tiptap/react';
import type { SuggestionOptions } from '@tiptap/suggestion';

import { MentionList, type MentionListHandle } from '@/components/editor/MentionList';

/** One row in the `@` suggestion popup — a workspace member or a project task. */
export type MentionItem =
  | { kind: 'user'; id: string; label: string; avatarUrl: string | null }
  | { kind: 'task'; id: string; taskKey: string; title: string };

/**
 * Builds the `suggestion` option for the Mention extension in `RichTextEditor.tsx`.
 *
 * One `@` trigger surfaces both kinds of result (channel members and, if the
 * channel has a linked project, that project's tasks) in a single ranked
 * list — picking a user inserts a real mention node (see the extension's
 * markdown serializer), picking a task inserts plain `@TASK-12` text, which
 * the backend's existing task-mention regex already understands unchanged.
 *
 * `getItems` is read fresh on every keystroke via the ref passed in from
 * `RichTextEditor` — see that file's `mentionsRef` for why this needs to be a
 * live reference rather than a value captured once at extension-creation time.
 */
export function buildMentionSuggestion(
  getItems: (query: string, signal: AbortSignal) => Promise<MentionItem[]> | MentionItem[],
): Omit<SuggestionOptions<MentionItem>, 'editor'> {
  return {
    char: '@',
    items: ({ query, signal }) => getItems(query, signal),
    command: ({ editor, range, props }) => {
      if (props.kind === 'task') {
        editor.chain().focus().insertContentAt(range, `@${props.taskKey} `).run();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: props.id, label: props.label } },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle, any> | null = null;

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, { props, editor: props.editor });
          // Mount the invisible wrapper to the DOM so React events bubble correctly.
          // The actual MentionList will use Shadcn Popover to portal to the body.
          document.body.appendChild(component.element);
        },
        onUpdate: (props) => {
          component?.updateProps(props);
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            return true; // Let tiptap handle escape to exit
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit: () => {
          if (component?.element) {
            component.element.remove();
          }
          component?.destroy();
        },
      };
    },
  };
}
