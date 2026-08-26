import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FileTextIcon,
  Loader2Icon,
  MicIcon,
  PaperclipIcon,
  ArrowUpIcon,
  VideoIcon,
  XIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Spinner } from '@/components/ui/spinner';
import { apiFetch } from '@/lib/api';
import { classifyFile, fileToBase64, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/files';
import { RichTextEditor, type RichTextEditorHandle } from '@/components/editor/RichTextEditor';
import type { AttachmentPayload } from '@/pages/channels/ChannelPage';

interface PendingAttachment {
  id: string;
  name: string;
  sizeBytes: number;
  state: 'uploading' | 'done' | 'error';
  url?: string;
  type: string;
  /** Only set on `error` — the description shows this instead of the size, per `Attachment`'s own a11y guidance: the failure reason has to be legible text, not just the destructive colour. */
  error?: string;
}

/**
 * The Slack-styled message composer, built on `RichTextEditor` (Tiptap).
 *
 * `bodyText` sent to the server is still markdown (`**bold**`) — same as the
 * plain-textarea version this replaces — because `RichTextEditor`'s wire
 * format *is* markdown (`tiptap-markdown`, see that file's own doc comment).
 * `lib/renderMarkdownMessage.ts` converts it to sanitized HTML at render
 * time, entirely unchanged by this swap.
 *
 * Attachments upload through the backend (`/files/upload`, same as
 * `TaskAttachments.tsx`), not straight to Supabase from the browser —
 * `workspace-files` is a private bucket, so only the service-role key the
 * backend holds can write to it or mint a URL for what it stores. The
 * `?persistent=true` download call asks for a signed URL good for ten years
 * rather than the endpoint's usual one hour: this URL gets stored on the
 * message forever (`bodyBlocks`), unlike a task attachment's URL, which is
 * fetched fresh on every click and never persisted.
 */
export function MessageComposer({
  slug,
  placeholder,
  disabled,
  onSend,
}: {
  slug: string;
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
  const [isEmpty, setIsEmpty] = useState(true);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // One at a time, same reasoning as `TaskAttachments.tsx`: each request
    // carries the whole file base64-encoded in its body, so sending several
    // at once would multiply peak memory for no gain.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attId = newAttachments[i].id;
      try {
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error(`${file.name} is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`);
        }

        const uploaded = await apiFetch(`/workspaces/${slug}/files/upload`, {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            mimetype: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            filetype: classifyFile(file),
            fileBase64: await fileToBase64(file),
          }),
        });

        const { downloadUrl } = await apiFetch(
          `/workspaces/${slug}/files/${uploaded.fileRecord.fileId}/download?persistent=true`,
        );

        setAttachments((prev) =>
          prev.map((a) => (a.id === attId ? { ...a, state: 'done', url: downloadUrl } : a)),
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Upload failed: ${message}`);
        setAttachments((prev) => prev.map((a) => (a.id === attId ? { ...a, state: 'error', error: message } : a)));
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    if (disabled) return;
    if (attachments.some((a) => a.state === 'uploading')) {
      toast.error('Please wait for uploads to finish.');
      return;
    }
    if (isEmpty && attachments.length === 0) return;

    const body = editorRef.current?.getMarkdown().trim() ?? '';

    // Cleared only once the send actually succeeds — a failed request (an
    // announcement-only channel, a dropped connection) otherwise loses
    // whatever was typed, forcing a retype on top of the retry.
    void Promise.resolve(
      onSend(
        body,
        attachments.filter((a) => a.state === 'done').map((a) => ({
          name: a.name,
          url: a.url,
          sizeBytes: a.sizeBytes,
          mimetype: a.type,
        })),
      ),
    ).then((ok) => {
      if (ok === false) return;
      editorRef.current?.clear();
      setIsEmpty(true);
      setAttachments([]);
    });
  };

  const iconBtn = 'size-4 text-muted-foreground';

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3">
      {attachments.length > 0 && (
        // `items-start`: the group's own default is `stretch`, which pads a
        // small horizontal file card up to match a tall image card in the
        // same row — only images are meant to be big.
        <AttachmentGroup className="items-start">
          {attachments.map((att) => {
            const isImage = att.type.startsWith('image/');
            return (
              <Attachment
                key={att.id}
                state={att.state}
                orientation={isImage ? 'vertical' : 'horizontal'}
                // `!` (important) is load-bearing on the image case — see the
                // matching comment in `ChannelPage.tsx`'s attachment render.
                // Files/PDFs stay at the component's own default horizontal
                // size — only images are meant to be big.
                className={isImage ? 'w-72!' : undefined}
              >
                <AttachmentMedia variant={isImage ? 'image' : 'icon'}>
                  {/* A spinner reads at a glance; nobody stops to read
                      "Uploading…" text. `data-slot="spinner"` is what the
                      component's own vertical/image styling already targets
                      (`attachment.tsx` sizes it up for image cards) —
                      bumped further for images since that card is now much
                      bigger than the built-in sizing assumes; left at the
                      component's own default for the small file/PDF case. */}
                  {att.state === 'uploading' ? (
                    <Spinner className={isImage ? 'size-12!' : undefined} />
                  ) : isImage && att.url ? (
                    <img src={att.url} alt="" />
                  ) : (
                    <FileTextIcon />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{att.name}</AttachmentTitle>
                  {/* The size is known client-side before the upload even
                      starts, so it stays put throughout — only the failure
                      reason needs to replace it, per `Attachment`'s own a11y
                      guidance that `error` can't be conveyed by colour alone. */}
                  <AttachmentDescription>
                    {att.state === 'error' ? (att.error ?? 'Upload failed') : `${Math.round(att.sizeBytes / 1024)} KB`}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction aria-label="Remove" onClick={() => removeAttachment(att.id)}>
                    <XIcon />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            );
          })}
        </AttachmentGroup>
      )}

      <RichTextEditor
        ref={editorRef}
        placeholder={placeholder}
        disabled={disabled}
        onChange={() => setIsEmpty(editorRef.current?.isEmpty() ?? true)}
        onSubmit={handleSubmit}
        leading={
          <>
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
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
          </>
        }
        trailing={
          <Button
            onClick={handleSubmit}
            disabled={disabled || (isEmpty && attachments.length === 0)}
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpIcon className="size-4" aria-hidden="true" />
            )}
          </Button>
        }
      />
    </div>
  );
}
