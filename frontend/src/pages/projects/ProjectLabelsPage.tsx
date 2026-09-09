import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2Icon, PencilIcon, PlusIcon, TagIcon, Trash2Icon } from 'lucide-react';

import { ErrorState } from '@/components/layout/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useLabelStore } from '@/store/labelStore';
import { useMyProjectRole } from '@/store/projectStore';
import type { ProjectLabel } from '@/types/api';

/** The colour `labels.controller.ts` assigns when none is supplied. */
const DEFAULT_COLOR = '#6b7280';

/** `createLabelSchema` validates colour against exactly this shape. */
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * `listLabels` returns every label in one payload with no pagination, and a
 * long-lived project accumulates hundreds. Render a window of them and let the
 * filter reach the rest, rather than putting the whole catalogue on screen.
 */
const VISIBLE_LIMIT = 50;

export function ProjectLabelsPage() {
  const { slug = '', key = '' } = useParams();
  const { labels, isLoading, error, fetchLabels, createLabel, updateLabel, deleteLabel, reset } =
    useLabelStore();
  const myRole = useMyProjectRole();

  // POST/PATCH need developer or above; DELETE is project_admin only.
  const canEdit = myRole === 'project_admin' || myRole === 'developer';
  const canDelete = myRole === 'project_admin';

  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  // Labels created in this session. The catalogue is sorted by name, so a new
  // label usually lands outside the visible window and would look as though it
  // had not been created at all. These are pinned to the top for as long as the
  // page is open.
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const matching = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? labels.filter((l) => l.name.toLowerCase().includes(q)) : labels;
  }, [labels, filter]);

  const visible = useMemo(() => {
    if (recentIds.length === 0) return matching.slice(0, VISIBLE_LIMIT);
    const recent = new Set(recentIds);
    const pinned = matching.filter((l) => recent.has(l.labelId));
    const rest = matching.filter((l) => !recent.has(l.labelId));
    return [...pinned, ...rest].slice(0, VISIBLE_LIMIT);
  }, [matching, recentIds]);

  const hiddenCount = matching.length - visible.length;

  useEffect(() => {
    if (slug && key) void fetchLabels(slug, key);
    return () => reset();
  }, [slug, key, fetchLabels, reset]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const created = await createLabel(slug, key, trimmed, color);
      setRecentIds((prev) => [created.labelId, ...prev]);
      setName('');
      setColor(DEFAULT_COLOR);
      toast.success(`Label "${created.name}" created`);
    } catch (err) {
      // 409 when the name already exists, case-insensitively.
      toast.error(err instanceof Error ? err.message : 'Could not create that label.');
    } finally {
      setCreating(false);
    }
  };

  const saveEdit = async (label: ProjectLabel, patch: { name?: string; color?: string }) => {
    setBusyId(label.labelId);
    try {
      await updateLabel(slug, key, label.labelId, patch);
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update that label.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (label: ProjectLabel) => {
    setBusyId(label.labelId);
    try {
      await deleteLabel(slug, key, label.labelId);
      toast.success(`Label "${label.name}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete that label.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Labels"
        description="Shared tags for this project's tasks. Renaming one updates every task that uses it."
      />

      {error ? (
        <ErrorState message={error} className="mb-4" />
      ) : null}

      {canEdit ? (
        <Card className="mb-6">
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <FieldGroup>
                <div className="flex flex-wrap items-end gap-3">
                  <Field className="min-w-48 flex-1">
                    <FieldLabel htmlFor="labelName">New label</FieldLabel>
                    <Input
                      id="labelName"
                      value={name}
                      maxLength={50}
                      placeholder="frontend"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field className="w-28">
                    <FieldLabel htmlFor="labelColor">Colour</FieldLabel>
                    <Input
                      id="labelColor"
                      type="color"
                      value={color}
                      className="h-9 p-1"
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </Field>
                  <Button type="submit" disabled={!name.trim() || creating}>
                    {creating ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <PlusIcon className="size-4" aria-hidden="true" />
                    )}
                    Add label
                  </Button>
                </div>
                <FieldDescription>
                  Names are unique per project and matched without regard to case.
                </FieldDescription>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : labels.length === 0 ? (
        <Empty className="rounded-2xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No labels yet</EmptyTitle>
            <EmptyDescription>
              {canEdit
                ? 'Add one above to start grouping tasks.'
                : 'A project admin or developer can add labels.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter labels"
              aria-label="Filter labels"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              {matching.length === labels.length
                ? `${labels.length} labels`
                : `${matching.length} of ${labels.length} labels`}
            </p>
          </div>

          <Card>
            <CardContent className="px-0">
              <ul className="divide-y">
              {visible.map((label) =>
                editingId === label.labelId ? (
                  <li key={label.labelId} className="px-4 py-3">
                    <LabelEditor
                      label={label}
                      busy={busyId === label.labelId}
                      onCancel={() => setEditingId(null)}
                      onSave={(patch) => void saveEdit(label, patch)}
                    />
                  </li>
                ) : (
                  <li key={label.labelId} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {label.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {label.usageCount} {label.usageCount === 1 ? 'task' : 'tasks'}
                    </span>

                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        aria-label={`Edit ${label.name}`}
                        onClick={() => setEditingId(label.labelId)}
                      >
                        <PencilIcon className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}

                    {canDelete ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${label.name}`}
                            disabled={busyId === label.labelId}
                          >
                            <Trash2Icon className="size-3.5" aria-hidden="true" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {label.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {label.usageCount > 0
                                ? `It will also be removed from ${label.usageCount} ${
                                    label.usageCount === 1 ? 'task' : 'tasks'
                                  }. This cannot be undone.`
                                : 'This cannot be undone.'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => {
                                e.preventDefault();
                                void remove(label);
                              }}
                            >
                              Delete label
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </li>
                ),
              )}
                {hiddenCount > 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">
                    {hiddenCount} more {hiddenCount === 1 ? 'label' : 'labels'} — use the filter to
                    find one.
                  </li>
                ) : matching.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">
                    No label matches that search.
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}

function LabelEditor({
  label,
  busy,
  onSave,
  onCancel,
}: {
  label: ProjectLabel;
  busy: boolean;
  onSave: (patch: { name?: string; color?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(HEX.test(label.color) ? label.color : DEFAULT_COLOR);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // `updateLabelSchema` is .strict() with every field optional — send only the
    // ones that actually changed.
    const patch: { name?: string; color?: string } = {};
    if (trimmed !== label.name) patch.name = trimmed;
    if (color !== label.color) patch.color = color;
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }
    onSave(patch);
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-9 w-14 shrink-0 p-1"
        aria-label={`Colour for ${label.name}`}
      />
      <Input
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        aria-label={`Name for ${label.name}`}
        className="min-w-40 flex-1"
      />
      <Button type="submit" size="sm" disabled={busy || !name.trim()}>
        {busy ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </form>
  );
}
