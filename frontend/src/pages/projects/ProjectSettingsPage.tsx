import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { useProjectStore, useMyProjectRole } from '@/store/projectStore';
import { ErrorState } from '@/components/layout/PageState';
import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the editable half of `updateProjectSchema`. */
const schema = z.object({
  name: z.string().trim().min(1, 'Project name cannot be empty'),
  description: z.string().trim().optional(),
});

type Values = z.infer<typeof schema>;

export function ProjectSettingsPage() {
  const { slug = '', key = '' } = useParams();
  const navigate = useNavigate();
  const { project, updateProject, archiveProject, deleteProject, error: projectError } = useProjectStore();
  const myRole = useMyProjectRole();
  const canEdit = myRole === 'project_admin' || myRole === 'developer';
  const canArchive = myRole === 'project_admin';
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const { reset } = form;
  useEffect(() => {
    if (project) {
      reset({ name: project.name, description: project.description ?? '' });
    }
  }, [project, reset]);

  const { isSubmitting, errors, isDirty } = form.formState;

  const onSubmit = async (values: Values) => {
    try {
      await updateProject(slug, key, values);
      form.reset(values);
      toast.success('Project updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the project.');
    }
  };

  const onArchive = async () => {
    setArchiving(true);
    try {
      await archiveProject(slug, key);
      toast.success(`${project?.key} archived`);
      navigate(`/w/${slug}/projects`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive the project.');
      setArchiving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const deletedKey = project?.key;
      await deleteProject(slug, key);
      toast.success(`${deletedKey} deleted`);
      navigate(`/w/${slug}/projects`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the project.');
      setDeleting(false);
    }
  };

  // Previously `return null`, which rendered a blank page while the project
  // loaded and again if the fetch failed — indistinguishable from a broken route.
  if (!project) {
    return (
      <PageShell narrow>
        <PageHeader title="Project settings" />
        {projectError ? (
          <ErrorState message={projectError} />
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader title="Project settings" />

      {!canEdit ? (
        <Alert className="mb-6">
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>
            Your role on this project does not allow changing its settings.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="s-name">Name</FieldLabel>
                <Input
                  id="s-name"
                  type="text"
                  disabled={!canEdit}
                  aria-invalid={!!errors.name}
                  {...form.register('name')}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="s-key">Key</FieldLabel>
                <Input id="s-key" type="text" value={project.key} readOnly disabled className="font-mono" />
                <FieldDescription>
                  Permanent — every issue key ({project.key}-1, {project.key}-2, …) depends on it.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="s-description">Description</FieldLabel>
                <Textarea
                  id="s-description"
                  rows={3}
                  disabled={!canEdit}
                  {...form.register('description')}
                />
              </Field>

              {canEdit ? (
                <div>
                  <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? (
                      <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Save changes
                  </Button>
                </div>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {canArchive && project.status === 'active' ? (
        <Card className="mt-8 ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Archiving hides the project from the sidebar and the project list. Its tasks, sprints
              and history are kept.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={archiving}>
                  {archiving ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Archive project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {project.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It disappears from the project list for everyone. Nothing is deleted, but the
                    only way back is a direct link to this settings page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void onArchive()}>Archive</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}

      {project.status === 'archived' && canEdit ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>This project is archived</CardTitle>
            <CardDescription>
              It is hidden from the project list. Restoring puts it back for everyone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                void updateProject(slug, key, { status: 'active' })
                  .then(() => toast.success('Project restored'))
                  .catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : 'Could not restore.'),
                  );
              }}
            >
              Restore project
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canArchive ? (
        <Card className="mt-8 ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Delete project</CardTitle>
            <CardDescription>
              Removes {project.key} from every list for everyone. Unlike archiving, there is no
              {' '}
              restore button — only a direct link to this page could ever bring it back, and nothing
              in the app offers one. Its tasks, sprints and history are kept but become unreachable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Delete project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone from the app. Type the project key to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={project.key}
                  aria-label={`Type ${project.key} to confirm`}
                  className="font-mono"
                />

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== project.key || deleting}
                    onClick={(e) => {
                      // Keep the dialog open if the typed key does not match.
                      if (confirmText !== project.key) {
                        e.preventDefault();
                        return;
                      }
                      void onDelete();
                    }}
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}
    </PageShell>
  );
}
