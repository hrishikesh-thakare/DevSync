import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Loader2Icon, PlusIcon, SparklesIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useSprintStore } from '@/store/sprintStore';
import { useMyProjectRole } from '@/store/projectStore';
import type { Sprint } from '@/types/api';

const STATUS_VARIANT = {
  future: 'outline',
  active: 'default',
  closed: 'secondary',
} as const;

export function SprintListPage() {
  const { slug = '', key = '' } = useParams();
  const { sprints, isLoading, error, fetchSprints, createSprint, startSprint, closeSprint, deleteSprint } =
    useSprintStore();
  const myRole = useMyProjectRole();
  // Sprint lifecycle is project_admin only, matching requireProjectRole on every
  // mutating sprint route.
  const canManage = myRole === 'project_admin';

  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (slug && key) void fetchSprints(slug, key);
  }, [slug, key, fetchSprints]);

  const hasActive = sprints.some((s) => s.status === 'active');

  const onStart = async (sprint: Sprint) => {
    setBusy(sprint.sprintId);
    try {
      await startSprint(slug, key, sprint.sprintId);
      toast.success(`${sprint.name} started`);
    } catch (err) {
      // 409 when another sprint is already active.
      toast.error(err instanceof Error ? err.message : 'Could not start the sprint.');
    } finally {
      setBusy(null);
    }
  };

  const onClose = async (sprint: Sprint) => {
    setBusy(sprint.sprintId);
    try {
      const stats = await closeSprint(slug, key, sprint.sprintId);
      toast.success(
        `${sprint.name} closed — ${stats.completed} of ${stats.totalTasks} done, ${stats.incomplete} returned to the backlog`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not close the sprint.');
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (sprint: Sprint) => {
    setBusy(sprint.sprintId);
    try {
      await deleteSprint(slug, key, sprint.sprintId);
      toast.success(`${sprint.name} deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the sprint.');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="mb-6 h-9 w-48 rounded-lg" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      </PageShell>
    );
  }

  const groups: { label: string; items: Sprint[] }[] = [
    { label: 'Active', items: sprints.filter((s) => s.status === 'active') },
    { label: 'Future', items: sprints.filter((s) => s.status === 'future') },
    { label: 'Closed', items: sprints.filter((s) => s.status === 'closed') },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Sprints"
        description="One sprint runs at a time. Closing a sprint returns unfinished tasks to the backlog."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New sprint
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      {sprints.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sprints yet.{canManage ? ' Create one to start planning.' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.label}>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">{group.label}</h2>
                <div className="space-y-4">
                  {group.items.map((sprint) => {
                    const stats = sprint.stats;
                    const pct =
                      stats && stats.totalPoints > 0
                        ? Math.round((stats.completedPoints / stats.totalPoints) * 100)
                        : stats && stats.taskCount > 0
                          ? Math.round((stats.completedCount / stats.taskCount) * 100)
                          : 0;

                    return (
                      <Card key={sprint.sprintId}>
                        <CardHeader>
                          <CardTitle className="flex flex-wrap items-center gap-2">
                            {sprint.name}
                            <Badge variant={STATUS_VARIANT[sprint.status]}>{sprint.status}</Badge>
                            {busy === sprint.sprintId ? (
                              <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                            ) : null}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {sprint.goal ? (
                            <p className="text-sm text-muted-foreground">{sprint.goal}</p>
                          ) : null}

                          {sprint.startDate || sprint.endDate ? (
                            <p className="text-xs text-muted-foreground">
                              {sprint.startDate ? format(new Date(sprint.startDate), 'd MMM yyyy') : '—'}
                              {' → '}
                              {sprint.endDate ? format(new Date(sprint.endDate), 'd MMM yyyy') : '—'}
                            </p>
                          ) : null}

                          {stats ? (
                            <div>
                              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  {stats.completedCount} of {stats.taskCount} tasks
                                  {stats.totalPoints > 0
                                    ? ` · ${stats.completedPoints}/${stats.totalPoints} points`
                                    : ''}
                                </span>
                                <span>{pct}%</span>
                              </div>
                              <Progress value={pct} />
                            </div>
                          ) : null}

                          {sprint.aiSummary ? <SprintRetrospective sprint={sprint} /> : null}

                          {canManage ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {sprint.status === 'future' ? (
                                <Button
                                  size="sm"
                                  disabled={busy !== null || hasActive}
                                  title={hasActive ? 'Another sprint is already active' : undefined}
                                  onClick={() => void onStart(sprint)}
                                >
                                  Start sprint
                                </Button>
                              ) : null}

                              {sprint.status === 'active' ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" disabled={busy !== null}>
                                      Close sprint
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Close {sprint.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Unfinished tasks move back to the backlog. If AI is
                                        configured, a retrospective is posted to the project channel.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => void onClose(sprint)}>
                                        Close sprint
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : null}

                              {sprint.status !== 'active' ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="ghost" disabled={busy !== null}>
                                      Delete
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete {sprint.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        The sprint is removed. Its tasks are not deleted.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => void onDelete(sprint)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : null}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      {createOpen ? (
        <CreateSprintDialog
          slug={slug}
          projectKey={key}
          onClose={() => setCreateOpen(false)}
          onCreate={createSprint}
        />
      ) : null}
    </PageShell>
  );
}

function CreateSprintDialog({
  slug,
  projectKey,
  onClose,
  onCreate,
}: {
  slug: string;
  projectKey: string;
  onClose: () => void;
  onCreate: ReturnType<typeof useSprintStore.getState>['createSprint'];
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [capacity, setCapacity] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError('Sprint name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The schema wants full ISO datetimes; a date input yields YYYY-MM-DD.
      await onCreate(slug, projectKey, {
        name: name.trim(),
        ...(goal.trim() ? { goal: goal.trim() } : {}),
        ...(capacity ? { capacityPoints: Number(capacity) } : {}),
        ...(start ? { startDate: new Date(`${start}T00:00:00`).toISOString() } : {}),
        ...(end ? { endDate: new Date(`${end}T23:59:59`).toISOString() } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the sprint.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
          <DialogDescription>
            Sprints start in the future state. Start one when the team is ready.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field data-invalid={!!error && !name.trim()}>
            <FieldLabel htmlFor="sp-name">Name</FieldLabel>
            <Input
              id="sp-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 12"
            />
            <FieldError errors={!name.trim() && error ? [{ message: 'Sprint name is required' }] : []} />
          </Field>

          <Field>
            <FieldLabel htmlFor="sp-goal">Goal</FieldLabel>
            <Textarea
              id="sp-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Optional — what this sprint is for."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="sp-start">Start date</FieldLabel>
              <Input id="sp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sp-end">End date</FieldLabel>
              <Input id="sp-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="sp-capacity">Capacity (points)</FieldLabel>
            <Input
              id="sp-capacity"
              type="text"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ''))}
              placeholder="Optional"
            />
            <FieldDescription>Used to compare planned against completed points.</FieldDescription>
          </Field>

          <DialogFooter>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
              Create sprint
            </Button>
          </DialogFooter>
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The AI retrospective written on sprint close.
 *
 * The data has always been returned by `GET .../sprints` — `listSprints`
 * selects every column — but nothing rendered it, so the report only ever
 * reached people as a chat message in the project channel. Renders nothing
 * when Gemini is unconfigured, since the columns stay null.
 */
function SprintRetrospective({ sprint }: { sprint: Sprint }) {
  const [open, setOpen] = useState(false);
  const report = sprint.aiSummary;
  if (!report) return null;

  const contributions = sprint.aiContributionReport ?? [];

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-start gap-2">
        <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Retrospective</p>
          <p className="mt-1 text-sm text-muted-foreground">{report.summary}</p>

          {open ? (
            <>
              {report.highlights.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {report.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              ) : null}

              {contributions.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Contributions
                  </p>
                  {contributions.map((c) => (
                    <div key={`${c.userId ?? c.fullName}`} className="text-sm">
                      <span className="text-foreground">{c.fullName}</span>
                      <span className="text-muted-foreground">
                        {' '}
                        · {c.tasksCompleted} {c.tasksCompleted === 1 ? 'task' : 'tasks'}
                      </span>
                      <p className="text-muted-foreground">{c.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {report.highlights.length > 0 || contributions.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? 'Show less' : 'Show more'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
