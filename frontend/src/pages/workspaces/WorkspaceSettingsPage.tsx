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
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { apiFetch } from '@/lib/api';

/** Mirrors `updateWorkspaceSchema`. */
const schema = z.object({
  name: z.string().trim().min(1, 'Workspace name cannot be empty'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug cannot be empty')
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().trim().optional(),
});

type Values = z.infer<typeof schema>;

export function WorkspaceSettingsPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { name, description, isOwner, isAdmin, fetchWorkspaceData } = useCurrentWorkspaceStore();
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);

  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const canEdit = isAdmin();
  const canDelete = isOwner();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', description: '' },
  });

  const { reset } = form;
  useEffect(() => {
    reset({ name, slug, description: description ?? '' });
  }, [name, slug, description, reset]);

  const { isSubmitting, errors, isDirty } = form.formState;

  const onSubmit = async (values: Values) => {
    try {
      const data = await apiFetch(`/workspaces/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      const nextSlug = data.workspace.slug as string;
      toast.success('Workspace updated');
      await fetchWorkspaces();

      // Changing the slug changes every URL under /w/:slug, so move the router
      // before refetching against a slug that no longer resolves.
      if (nextSlug !== slug) {
        navigate(`/w/${nextSlug}/settings`, { replace: true });
      } else {
        form.reset(values);
        await fetchWorkspaceData(slug);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the workspace.');
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/workspaces/${slug}`, { method: 'DELETE' });
      toast.success(`${name} deleted`);
      await fetchWorkspaces();
      navigate('/workspaces', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the workspace.');
      setDeleting(false);
    }
  };

  if (!canEdit) {
    return (
      <PageShell narrow>
        <PageHeader title="Workspace settings" />
        <Alert variant="destructive">
          <AlertTitle>You do not have access to these settings</AlertTitle>
          <AlertDescription>Only workspace owners and admins can change them.</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader title="Workspace settings" />

      <Card>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="w-name">Name</FieldLabel>
                <Input id="w-name" type="text" aria-invalid={!!errors.name} {...form.register('name')} />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.slug}>
                <FieldLabel htmlFor="w-slug">URL slug</FieldLabel>
                <Input
                  id="w-slug"
                  type="text"
                  className="font-mono"
                  aria-invalid={!!errors.slug}
                  {...form.register('slug')}
                />
                {errors.slug ? (
                  <FieldError errors={[errors.slug]} />
                ) : (
                  <FieldDescription>
                    Changing this changes every link to this workspace. Existing bookmarks will break.
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="w-description">Description</FieldLabel>
                <Textarea id="w-description" rows={3} {...form.register('description')} />
              </Field>

              <div>
                <Button type="submit" disabled={isSubmitting || !isDirty}>
                  {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Save changes
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {canDelete ? (
        <Card className="mt-8 ring-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Deleting removes this workspace and every project, channel and message in it for all
              {' '}
              members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog onOpenChange={(open) => !open && setConfirmText('')}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  Delete workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone from the app. Type the workspace name to confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={name}
                  aria-label={`Type ${name} to confirm`}
                />

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={confirmText !== name || deleting}
                    onClick={(e) => {
                      // Keep the dialog open if the typed name does not match.
                      if (confirmText !== name) {
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
