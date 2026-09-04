import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import {
  BoldIcon,
  Code2Icon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  StrikethroughIcon,
} from 'lucide-react';

import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A Tiptap editor, wire format markdown. Every DevSync surface that stores
 * message-style text already speaks markdown end to end — `bodyText` on the
 * wire, `lib/renderMarkdownMessage.ts` (via `marked`) turning it back into
 * sanitized HTML for display. `tiptap-markdown` makes that Tiptap's *native*
 * storage format too (`editor.storage.markdown.getMarkdown()`), so swapping
 * the input widget changes nothing downstream: no sanitizer allowlist change,
 * no backend schema change, no render-path change. Every mark/node this
 * editor can produce (bold, italic, strike, code, code block, lists,
 * blockquote, link) was checked directly against `tiptap-markdown`'s own
 * serializer source and against `sanitizeMessageHtml.ts`'s `ALLOWED_TAGS` —
 * nothing here can emit a tag that allowlist does not already cover.
 *
 * `MessageComposer.tsx` used to carry a long comment explaining why it was
 * deliberately *not* this — an earlier Tiptap integration caused bugs that
 * traced back to page-level CSS and to how hard contentEditable is to verify
 * without a browser to click through. Neither risk is unique to Tiptap or
 * this component, but they are why this file keeps the surface small
 * (StarterKit + Link + Placeholder, nothing else), leaves list/Enter
 * semantics exactly as blunt as the plain-textarea version (Enter always
 * submits; no "am I inside a list" special-casing), and is verified — like
 * every other page in this app — against a headless browser, not assumed.
 *
 * Layout is toolbar row, then a second row holding the editable area plus
 * optional `leading`/`trailing` slots either side of it — inline icon
 * buttons (attach, send) live there, inside the same bordered card, the way
 * `MessageComposer` uses it. A plain field just leaves both empty.
 */
export interface RichTextEditorHandle {
  focus: () => void;
  /** Clears content and fires `onChange('')`, same as any other edit would. */
  clear: () => void;
  getMarkdown: () => string;
  isEmpty: () => boolean;
}

export interface RichTextEditorProps {
  /** Initial content, as markdown. Uncontrolled after mount — same contract a `defaultValue` textarea would have. */
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  /** Enter without Shift. Shift+Enter always inserts a line break. */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  /**
   * Rendered inline with the editable area, inside the same bordered card,
   * before/after it — e.g. an attach-file button on one side and a send
   * button on the other, the way `MessageComposer` uses this. Both are
   * `undefined` for a plain field (a task description, say): the row still
   * renders, it just has nothing either side of the text.
   */
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * The `EditorContent` root's styling. Kept as Tailwind arbitrary child
 * selectors rather than a global CSS class — every other piece of chrome in
 * this app is styled inline with Tailwind, and this is the one place a
 * contentEditable root needs its descendant tags (`<p>`, `<ul>`, `<pre>`,
 * the placeholder's `::before`) styled directly, since they come from
 * Tiptap's serializer, not from JSX this component controls.
 */
const EDITOR_CONTENT_CLASS = cn(
  'tiptap-content max-h-40 min-h-[28px] overflow-y-auto px-2 py-1 text-sm text-foreground outline-none',
  '[&_p]:m-0 [&_p+p]:mt-2',
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
  '[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]',
  '[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  // Tiptap's Placeholder extension marks the empty first paragraph with this
  // class + a `data-placeholder` attribute; there is no element to attach a
  // real `placeholder=` attribute to, so the text is a CSS pseudo-element.
  '[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
);

const TOOLBAR_ICON = 'size-4 text-muted-foreground';

function LinkPopover({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const { active, currentHref } = useEditorState({
    editor,
    selector: ({ editor }) => ({
      active: editor.isActive('link'),
      currentHref: (editor.getAttributes('link').href as string | undefined) ?? '',
    }),
  });
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentHref);

  const apply = () => {
    const href = url.trim();
    if (!href) {
      setOpen(false);
      return;
    }
    const { from, to } = editor.state.selection;
    const chain = editor.chain().focus();
    if (from === to) {
      // Nothing selected — insert the URL itself as the link text, same
      // fallback the old markdown toolbar used for an empty selection.
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl(currentHref);
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Toggle variant="outline" size="sm" pressed={active} aria-label="Link" disabled={disabled}>
          <Link2Icon className={TOOLBAR_ICON} aria-hidden="true" />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" align="start">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <Input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="h-8"
          />
          <Button type="submit" size="sm" className="h-8">
            {active ? 'Update' : 'Insert'}
          </Button>
        </form>
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full text-destructive hover:text-destructive"
            onClick={() => {
              editor.chain().focus().unsetLink().run();
              setOpen(false);
            }}
          >
            Remove link
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      codeBlock: editor.isActive('codeBlock'),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
    }),
  });

  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      <Toggle
        variant="outline"
        size="sm"
        pressed={state.bold}
        aria-label="Bold"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
      >
        <BoldIcon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={state.italic}
        aria-label="Italic"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
      >
        <ItalicIcon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={state.strike}
        aria-label="Strikethrough"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughIcon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <MarkButton editor={editor} mark="code" label="Code">
        <CodeIcon className="size-4" />
      </MarkButton>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

      <LinkPopover editor={editor} disabled={disabled} />

      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

      <Toggle
        variant="outline"
        size="sm"
        pressed={state.orderedList}
        aria-label="Numbered list"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrderedIcon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>
      <Toggle
        variant="outline"
        size="sm"
        pressed={state.bulletList}
        aria-label="Bulleted list"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListIcon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>

      <div className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

      <Toggle
        variant="outline"
        size="sm"
        pressed={state.codeBlock}
        aria-label="Code block"
        disabled={disabled}
        onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2Icon className={TOOLBAR_ICON} aria-hidden="true" />
      </Toggle>
    </div>
  );
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { defaultValue = '', onChange, onSubmit, placeholder, disabled, autoFocus, className, leading, trailing },
  ref,
) {
  // Read inside stable callbacks below instead of being dependencies of
  // `useEditor` — the editor is created once (see the `[]` deps at the call
  // site) and is not recreated when these props change on every render. The
  // assignment happens in an effect, not during render, so it always runs
  // after commit — event handlers and the placeholder function only ever
  // read these from a later tick anyway (a keystroke, an open popover), so
  // the one-tick lag behind the prop is never observable.
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const placeholderRef = useRef(placeholder);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
    placeholderRef.current = placeholder;
  });

  const editor = useEditor(
    {
      // React 18+ StrictMode double-invokes effects in dev; Tiptap's own
      // guidance for any React usage (SSR or not) is to disable render on
      // the first pass and let the effect mount it, rather than risk a
      // hydration/double-mount mismatch.
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
          },
        }),
        // `html: false` — this editor never needs to interpret raw HTML in
        // markdown source as real tags, on load or on paste; matches the
        // "never trust HTML passthrough" posture `sanitizeMessageHtml.ts`
        // documents for the render path. `breaks: true` matches `marked`'s
        // own config in `renderMarkdownMessage.ts` — chat is line-per-line,
        // a lone Enter should be a line break once rendered, not silently
        // swallowed until a blank line starts a new paragraph.
        Markdown.configure({ html: false, breaks: true, linkify: false, tightLists: true }),
        // The rule can't see that this closure is only ever invoked later, by
        // Tiptap's own placeholder decoration plugin while building each
        // ProseMirror transaction — never synchronously here, and never by
        // React at all. `placeholderRef` is exactly the escape hatch the ref
        // rule itself documents for values a non-React callback needs to
        // read after the fact.
        // eslint-disable-next-line react-hooks/refs -- read by Tiptap's plugin, not during React's render
        Placeholder.configure({ placeholder: () => placeholderRef.current ?? '' }),
      ],
      content: defaultValue,
      editable: !disabled,
      editorProps: {
        attributes: { class: EDITOR_CONTENT_CLASS },
        handleKeyDown: (_view, event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmitRef.current?.();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        onChangeRef.current?.(editor.storage.markdown.getMarkdown());
      },
    },
    [],
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    // `editorProps.attributes` is fixed at creation (the editor is only ever
    // built once — see the `[]` deps above), so a prop-driven label has to be
    // written straight onto the live contentEditable node instead. This is
    // the actual focusable/accessible element; an `aria-label` on the
    // `EditorContent` wrapper `<div>` sits one level too high to reach it.
    editor?.view.dom.setAttribute('aria-label', placeholder ?? '');
  }, [editor, placeholder]);

  useEffect(() => {
    if (editor && autoFocus) editor.commands.focus('end');
    // Mount-only: re-running this on every `editor`/`autoFocus` identity
    // change would steal focus back from wherever the user has since moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus(),
      clear: () => editor?.commands.clearContent(true),
      getMarkdown: () => editor?.storage.markdown.getMarkdown() ?? '',
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor],
  );

  if (!editor) return null;

  return (
    <div className={cn('flex flex-col rounded-lg border focus-within:ring-2 focus-within:ring-ring/40', className)}>
      <EditorToolbar editor={editor} disabled={disabled} />
      <div className="flex items-end gap-1 p-2">
        {leading}
        <EditorContent editor={editor} className="min-w-0 flex-1" />
        {trailing}
      </div>
    </div>
  );
});
