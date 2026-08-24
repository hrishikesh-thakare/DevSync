import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  BoldIcon,
  Code2Icon,
  CodeIcon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  Loader2Icon,
  MicIcon,
  PaperclipIcon,
  SendIcon,
  StrikethroughIcon,
  TextQuoteIcon,
  VideoIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment';
import { FileTextIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  insertLink,
  prefixBlockquote,
  prefixBulletList,
  prefixOrderedList,
  wrapCodeBlock,
  wrapSelection,
  type EditResult,
} from '@/lib/markdownComposer';
import type { AttachmentPayload } from '@/pages/channels/ChannelPage';

interface PendingAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  state: 'uploading' | 'done' | 'error';
  url?: string;
  type: string;
}

/**
 * The Slack-styled message composer.
 *
 * Deliberately a plain `<textarea>`, not a rich-text (contentEditable)
 * editor. An earlier version used Tiptap; every reported bug traced back
 * either to page-level CSS (fixed separately, in `sidebar.tsx`) or to how
 * hard it is to verify contentEditable/cursor/selection behaviour without a
 * browser to click through — and that risk doesn't go away by swapping to a
 * different editor library, it's inherent to the category. A textarea plus
 * markdown syntax around the selection is ordinary string manipulation:
 * verifiable by reading `lib/markdownComposer.ts` directly, not by trusting
 * an editor's internal document model.
 *
 * `bodyText` sent to the server is the raw markdown string (`**bold**`);
 * `lib/renderMarkdownMessage.ts` converts it to sanitized HTML at render time.
 */
export function MessageComposer({
  placeholder,
  disabled,
  onSend,
}: {
  placeholder: string;
  disabled?: boolean;
  /**
   * Returns (or resolves to) `false` on failure. `submit` in `ChannelPage`
   * already catches and toasts its own errors — it never rejects — so a
   * boolean is the only way this composer can tell success from failure and
   * decide whether to clear what was typed.
   */
  onSend: (bodyText: string, attachments: AttachmentPayload[]) => boolean | Promise<boolean>;
}) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Where the cursor/selection should land after the *next* render commits
  // the edit — a plain instance field would work too, but a ref keeps it
  // outside React's render cycle entirely, matching how `textareaRef` itself
  // is used just below.
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  /**
   * Applies a pure edit (see `lib/markdownComposer.ts`) to the textarea:
   * updates the controlled value, then restores focus and the selection
   * range the edit computed. The restore has to happen in a microtask after
   * `setValue` — React hasn't written the new value into the DOM yet at the
   * point this function returns, and a textarea clamps `setSelectionRange`
   * to whatever value is *currently* in the DOM.
   */
  const applyEdit = (edit: EditResult) => {
    setValue(edit.value);
    pendingSelection.current = { start: edit.selectionStart, end: edit.selectionEnd };
    queueMicrotask(() => {
      const el = textareaRef.current;
      const pending = pendingSelection.current;
      if (!el || !pending) return;
      el.focus();
      el.setSelectionRange(pending.start, pending.end);
      pendingSelection.current = null;
    });
  };

  const withSelection = (fn: (value: string, start: number, end: number) => EditResult) => {
    const el = textareaRef.current;
    if (!el || disabled) return;
    applyEdit(fn(value, el.selectionStart, el.selectionEnd));
  };

  const applyLink = () => {
    const el = textareaRef.current;
    const url = linkUrl.trim();
    if (!el || !url) {
      setLinkOpen(false);
      return;
    }
    applyEdit(insertLink(value, el.selectionStart, el.selectionEnd, url));
    setLinkUrl('');
    setLinkOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      sizeBytes: file.size,
      type: file.type,
      state: 'uploading' as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attId = newAttachments[i].id;
      try {
        const filePath = `uploads/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('workspaces').upload(filePath, file);
        if (error) throw error;

        const { data: urlData } = supabase.storage.from('workspaces').getPublicUrl(filePath);

        setAttachments((prev) =>
          prev.map((a) => (a.id === attId ? { ...a, state: 'done', url: urlData.publicUrl } : a)),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Upload failed: ${message}`);
        setAttachments((prev) => prev.map((a) => (a.id === attId ? { ...a, state: 'error' } : a)));
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const isEmpty = value.trim().length === 0;

  const handleSubmit = () => {
    if (disabled) return;
    if (attachments.some((a) => a.state === 'uploading')) {
      toast.error('Please wait for uploads to finish.');
      return;
    }
    if (isEmpty && attachments.length === 0) return;

    // Cleared only once the send actually succeeds — a failed request (an
    // announcement-only channel, a dropped connection) otherwise loses
    // whatever was typed, forcing a retype on top of the retry.
    void Promise.resolve(
      onSend(
        value.trim(),
        attachments.filter((a) => a.state === 'done').map((a) => ({
          name: a.name,
          url: a.url,
          sizeBytes: a.sizeBytes,
          mimetype: a.type,
        })),
      ),
    ).then((ok) => {
      if (ok === false) return;
      setValue('');
      setAttachments([]);
    });
  };

  const iconBtn = 'size-4 text-muted-foreground';

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3">
      {attachments.length > 0 && (
        <AttachmentGroup>
          {attachments.map((att) => (
            <Attachment key={att.id} state={att.state}>
              <AttachmentMedia variant={att.type.startsWith('image/') ? 'image' : 'icon'}>
                {att.type.startsWith('image/') && att.url ? <img src={att.url} alt="" /> : <FileTextIcon />}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{att.name}</AttachmentTitle>
                <AttachmentDescription>{Math.round(att.sizeBytes / 1024)} KB</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Remove" onClick={() => removeAttachment(att.id)}>
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}

      <div className="rounded-lg border focus-within:ring-2 focus-within:ring-ring/40">
        {/* Toolbar — each control inserts markdown syntax around the current
            selection. There is no live "is the cursor inside bold text"
            state to track, so every `Toggle` here is pinned `pressed={false}`
            and never latches down: it is the shadcn Toggle look (an outlined
            pill that lights up on hover/focus, matching the reference
            composer) wired to a one-shot action, not a real persistent
            toggle — a stuck-down Bold button would claim the selection is
            bold when it just isn't tracked. */}
        <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Bold"
            disabled={disabled}
            onPressedChange={() => withSelection((v, s, e) => wrapSelection(v, s, e, '**'))}
          >
            <BoldIcon className={iconBtn} aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Italic"
            disabled={disabled}
            onPressedChange={() => withSelection((v, s, e) => wrapSelection(v, s, e, '_'))}
          >
            <ItalicIcon className={iconBtn} aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Strikethrough"
            disabled={disabled}
            onPressedChange={() => withSelection((v, s, e) => wrapSelection(v, s, e, '~~'))}
          >
            <StrikethroughIcon className={iconBtn} aria-hidden="true" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Popover open={linkOpen} onOpenChange={setLinkOpen}>
            <PopoverTrigger asChild>
              <Toggle variant="outline" size="sm" pressed={linkOpen} aria-label="Link" disabled={disabled}>
                <Link2Icon className={iconBtn} aria-hidden="true" />
              </Toggle>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyLink();
                }}
              >
                <Input
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="h-8"
                />
                <Button type="submit" size="sm" className="h-8">
                  Insert
                </Button>
              </form>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Numbered list"
            disabled={disabled}
            onPressedChange={() => withSelection(prefixOrderedList)}
          >
            <ListOrderedIcon className={iconBtn} aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Bulleted list"
            disabled={disabled}
            onPressedChange={() => withSelection(prefixBulletList)}
          >
            <ListIcon className={iconBtn} aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Quote"
            disabled={disabled}
            onPressedChange={() => withSelection(prefixBlockquote)}
          >
            <TextQuoteIcon className={iconBtn} aria-hidden="true" />
          </Toggle>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Inline code"
            disabled={disabled}
            onPressedChange={() => withSelection((v, s, e) => wrapSelection(v, s, e, '`'))}
          >
            <CodeIcon className={iconBtn} aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={false}
            aria-label="Code block"
            disabled={disabled}
            onPressedChange={() => withSelection(wrapCodeBlock)}
          >
            <Code2Icon className={iconBtn} aria-hidden="true" />
          </Toggle>
        </div>

        <div className="flex items-end gap-1 px-1 py-1">
          <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            disabled={disabled}
          >
            <PaperclipIcon className={iconBtn} aria-hidden="true" />
          </Button>

          {/* Placeholders, matching the reference composer's action row —
              recording isn't implemented yet, so these are visibly inert
              rather than wired to a stub that would silently do nothing.
              The trigger is a plain span, not the button itself: a native
              `disabled` button doesn't reliably fire hover events in every
              browser, which would make the tooltip silently never open. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Record video (coming soon)"
                  disabled
                >
                  <VideoIcon className={iconBtn} aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Video messages — coming soon</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Record voice clip (coming soon)"
                  disabled
                >
                  <MicIcon className={iconBtn} aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Voice clips — coming soon</TooltipContent>
          </Tooltip>

          <Textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            disabled={disabled}
            className="max-h-40 min-h-10 resize-none border-0 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter inserts a newline — same as before;
              // a plain textarea has no "am I inside a list" ambiguity to
              // check the way an editor's Enter key does.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          <Button
            className="mb-0.5 shrink-0"
            onClick={handleSubmit}
            disabled={disabled || (isEmpty && attachments.length === 0)}
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <SendIcon className="size-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
