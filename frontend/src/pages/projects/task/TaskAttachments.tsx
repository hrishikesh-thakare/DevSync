import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DownloadIcon, Loader2Icon, PaperclipIcon, Trash2Icon, UploadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { formatBytes, MAX_UPLOAD_BYTES } from '@/lib/files';
import { useTaskDetailStore } from '@/store/taskDetailStore';
import type { TaskAttachment } from '@/types/api';

export function TaskAttachments({
  slug,
  projectKey,
  taskKey,
  attachments,
  canEdit,
}: {
  slug: string;
  projectKey: string;
  taskKey: string;
  attachments: TaskAttachment[];
  canEdit: boolean;
}) {
  const addAttachment = useTaskDetailStore((s) => s.addAttachment);
  const removeAttachment = useTaskDetailStore((s) => s.removeAttachment);

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    // Uploads run one at a time: each request carries the whole file base64-encoded
    // in its body, so sending several at once would multiply peak memory for no gain.
    for (const file of files) {
      setUploading((prev) => [...prev, file.name]);
      try {
        await addAttachment(slug, projectKey, taskKey, file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not upload ${file.name}.`);
      } finally {
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }

    // Reset the input so re-picking the same file still fires a change event.
    if (inputRef.current) inputRef.current.value = '';
  };

  const download = async (attachment: TaskAttachment) => {
    setBusyId(attachment.fileId);
    try {
      // The server decides where the bytes live — a Supabase signed URL, or its
      // own /raw endpoint with a short-lived JWT for locally stored files. Both
      // come back as an absolute URL, so the browser opens it directly.
      const data = await apiFetch(`/workspaces/${slug}/files/${attachment.fileId}/download`);
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open that file.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (attachment: TaskAttachment) => {
    setBusyId(attachment.fileId);
    try {
      await removeAttachment(slug, projectKey, taskKey, attachment.fileId);
      toast.success(`${attachment.filename} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove that attachment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <PaperclipIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          Attachments ({attachments.length})
        </h2>
        {canEdit ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading.length > 0}
            >
              {uploading.length > 0 ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UploadIcon className="size-4" aria-hidden="true" />
              )}
              Attach file
            </Button>
            {/* The visible button is the accessible control; this input is only
                ever opened programmatically, so it stays out of the tab order
                and out of the accessibility tree rather than being announced as
                a second, duplicate "attach" control. */}
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </>
        ) : null}
      </div>

      {attachments.length === 0 && uploading.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? `No attachments yet. Files up to ${formatBytes(MAX_UPLOAD_BYTES)} each.`
            : 'No attachments yet.'}
        </p>
      ) : (
        <ul className="space-y-1">
          {uploading.map((name) => (
            <li
              key={`uploading-${name}`}
              className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground"
            >
              <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="shrink-0 text-xs">Uploading…</span>
            </li>
          ))}

          {attachments.map((a) => (
            <li key={a.fileId} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{a.filename}</span>
              {a.sizeBytes ? (
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.sizeBytes)}</span>
              ) : null}
              <span className="shrink-0 text-xs text-muted-foreground">{a.uploaderName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`Download ${a.filename}`}
                onClick={() => void download(a)}
                disabled={busyId === a.fileId}
              >
                <DownloadIcon className="size-3.5" aria-hidden="true" />
              </Button>
              {canEdit ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${a.filename}`}
                  onClick={() => void remove(a)}
                  disabled={busyId === a.fileId}
                >
                  <Trash2Icon className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
