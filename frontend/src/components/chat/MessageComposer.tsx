import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2Icon,
  MicIcon,
  PaperclipIcon,
  ArrowUpIcon,
  SquareIcon,
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
import { attachmentIcon, classifyFile, fileToBase64, formatBytes, MAX_UPLOAD_BYTES } from '@/lib/files';
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
 *
 * Video/voice notes (the record buttons) share the upload plumbing with
 * ordinary attachments — `MediaRecorder` produces a plain
 * `video/webm`/`audio/webm` `Blob`, wrapped in a `File` — but not the
 * staging behaviour: a note sends itself the instant it finishes uploading
 * (`sendRecording`) instead of waiting in the composer for a manual Send
 * click, the way a picked file does. There is deliberately no live
 * signaling or peer-to-peer transport here (that's `CallPanel`, a different
 * feature for a different need — a live conversation, not an async note);
 * a recording is just a file someone happens to make with their camera/mic
 * instead of picking one off disk.
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

  const uploadFile = async (file: File) => {
    const id = crypto.randomUUID();
    setAttachments((prev) => [
      ...prev,
      { id, name: file.name, sizeBytes: file.size, type: file.type, state: 'uploading' as const },
    ]);

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

      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, state: 'done', url: downloadUrl } : a)));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${message}`);
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, state: 'error', error: message } : a)));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // One at a time, same reasoning as `TaskAttachments.tsx`: each request
    // carries the whole file base64-encoded in its body, so sending several
    // at once would multiply peak memory for no gain.
    for (const file of files) {
      await uploadFile(file);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Video/voice notes ──────────────────────────────────────────────────
  const [recordingKind, setRecordingKind] = useState<'video' | 'audio' | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const activeRecordingRef = useRef<{
    kind: 'video' | 'audio';
    recorder: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
  } | null>(null);

  useEffect(() => {
    if (!recordingKind) return;
    const id = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recordingKind]);

  // `<video>` only exists in the DOM once `recordingKind === 'video'`
  // triggers a render — `startRecording` sets that state, so on its very
  // first render `videoPreviewRef.current` is still null. This effect runs
  // after that render, once the element is actually mounted.
  useEffect(() => {
    if (recordingKind === 'video' && videoPreviewRef.current && activeRecordingRef.current) {
      videoPreviewRef.current.srcObject = activeRecordingRef.current.stream;
    }
  }, [recordingKind]);

  // Releases the camera/mic light even if the user navigates away (closes
  // the thread panel, switches channels) mid-recording instead of stopping
  // it first — `MediaRecorder.stop()` alone doesn't stop the underlying
  // tracks.
  useEffect(() => {
    return () => {
      const active = activeRecordingRef.current;
      if (!active) return;
      active.recorder.onstop = null;
      active.recorder.stop();
      active.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = async (kind: 'video' | 'audio') => {
    if (disabled || recordingKind) return;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('This browser cannot record audio/video.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'video' ? { video: true, audio: true } : { audio: true },
      );
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      activeRecordingRef.current = { kind, recorder, stream, chunks };
      recorder.start();
      setElapsedSec(0);
      setRecordingKind(kind);
    } catch (err) {
      toast.error(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied.'
          : `Could not start recording: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const cancelRecording = () => {
    const active = activeRecordingRef.current;
    if (!active) return;
    active.recorder.onstop = null; // discard — no upload
    active.recorder.stop();
    active.stream.getTracks().forEach((t) => t.stop());
    activeRecordingRef.current = null;
    setRecordingKind(null);
  };

  const finishRecording = () => {
    const active = activeRecordingRef.current;
    if (!active) return;
    active.recorder.onstop = () => {
      const mimeType = active.recorder.mimeType || (active.kind === 'video' ? 'video/webm' : 'audio/webm');
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const file = new File(active.chunks, `${active.kind}-note-${Date.now()}.${extension}`, { type: mimeType });
      active.stream.getTracks().forEach((t) => t.stop());
      activeRecordingRef.current = null;
      setRecordingKind(null);
      void sendRecording(file);
    };
    active.recorder.stop();
  };

  /**
   * A voice/video note sends itself the moment it finishes uploading,
   * unlike a picked file — which only stages an attachment and waits for
   * the ordinary Send click. The first version of this feature staged
   * recordings the same way a picked file is staged, and it read as
   * broken: a user who has just decided "stop == done" has no reason to
   * expect a second, separate Send click is still required, so the note
   * would sit in the composer, unsent, looking like nothing happened.
   *
   * This intentionally doesn't reuse `handleSubmit`: that reads `attachments`
   * and `isEmpty` from this function's own render closure, which is already
   * stale by the time `MediaRecorder.onstop` fires — `uploadFile` mutates
   * that state with a *functional* update, so the state itself ends up
   * correct, but a stale closure calling `handleSubmit` would still see the
   * pre-upload snapshot and could send without this attachment, or bail out
   * on the old `isEmpty`. Reading `editorRef` (always current, not a
   * snapshot) for the caption and sending this one file directly sidesteps
   * that entirely, at the cost of not bundling in any other file the user
   * happened to already have queued via the paperclip picker — an
   * acceptable trade: a note behaves as one atomic, independent message.
   */
  const sendRecording = async (file: File) => {
    const id = crypto.randomUUID();
    setAttachments((prev) => [
      ...prev,
      { id, name: file.name, sizeBytes: file.size, type: file.type, state: 'uploading' as const },
    ]);

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
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, state: 'done', url: downloadUrl } : a)));

      const body = editorRef.current?.getMarkdown().trim() ?? '';
      const ok = await onSend(body, [
        { name: file.name, url: downloadUrl, sizeBytes: file.size, mimetype: file.type },
      ]);

      // A failure here is a business-rule rejection `ChannelPage.submit`
      // already toasted (e.g. an announcement-only channel) — same as a
      // failed manual Send, leave the attachment in place (now `done`, not
      // `uploading`) so the ordinary Send button can retry it instead of
      // forcing a re-record.
      if (ok !== false) {
        editorRef.current?.clear();
        setIsEmpty(true);
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${message}`);
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, state: 'error', error: message } : a)));
    }
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

  const formatDuration = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3">
      {attachments.length > 0 && (
        // `items-start`: the group's own default is `stretch`, which pads a
        // small horizontal file card up to match a tall image card in the
        // same row — only images are meant to be big.
        <AttachmentGroup className="items-start">
          {attachments.map((att) => {
            const isImage = att.type.startsWith('image/');
            const Icon = attachmentIcon(att.type);
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
                    <Icon />
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

      {recordingKind ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          {recordingKind === 'video' ? (
            // A silent local self-view of the camera feed being recorded, not
            // a media source with a track of its own — no captions to add.
            <video ref={videoPreviewRef} muted autoPlay playsInline className="h-14 w-20 rounded-md bg-black object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-destructive/10">
              <MicIcon className="size-4 text-destructive" aria-hidden="true" />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            <span className="font-medium text-foreground">
              Recording {recordingKind === 'video' ? 'video' : 'voice'} note
            </span>
            <span className="text-muted-foreground tabular-nums">{formatDuration(elapsedSec)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Cancel recording" onClick={cancelRecording}>
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="destructive" size="icon-sm" aria-label="Stop and attach recording" onClick={finishRecording}>
              <SquareIcon className="size-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

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
              disabled={disabled || recordingKind !== null}
            >
              <PaperclipIcon className={iconBtn} aria-hidden="true" />
            </Button>

            {/* The trigger is a plain span, not the button itself: a native
                `disabled` button doesn't reliably fire hover events in every
                browser, which would make the tooltip silently never open
                while a recording is already in progress. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    aria-label="Record video note"
                    disabled={disabled || recordingKind !== null}
                    onClick={() => void startRecording('video')}
                  >
                    <VideoIcon className={iconBtn} aria-hidden="true" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Record a video note</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    aria-label="Record voice note"
                    disabled={disabled || recordingKind !== null}
                    onClick={() => void startRecording('audio')}
                  >
                    <MicIcon className={iconBtn} aria-hidden="true" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Record a voice note</TooltipContent>
            </Tooltip>
          </>
        }
        trailing={
          <Button
            onClick={handleSubmit}
            disabled={disabled || recordingKind !== null || (isEmpty && attachments.length === 0)}
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
