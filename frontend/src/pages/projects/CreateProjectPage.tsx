import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon, LockIcon } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState, ErrorState } from '@/components/layout/PageState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useProjectStore } from '@/store/projectStore';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';

/**
 * Mirrors `createProjectSchema` (backend/src/modules/projects/projects.schemas.ts).
 * That schema is `.strict()` and accepts only name, key, description and iconUrl
 * — there is no `leadUserId`, so the lead cannot be assigned at creation time
 * (nor by `updateProjectSchema`). The screen inventory in docs/navigation-flow.md
 * lists a Lead User field; the API does not support one today.
 */
const schema = z.object({
  name: z.string().trim().min(1, 'Project name is required'),
  key: z
    .string()
    .trim()
    .min(1, 'Project key is required')
    .max(10, 'Keys are at most 10 characters')
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, 'Start with a letter, then letters and numbers only'),
  description: z.string().trim().optional(),
});

type Values = z.infer<typeof schema>;

/** "Frontend App" becomes "FRON" — a sensible starting key the user can edit. */
function suggestKey(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const raw =
    words.length === 1
      ? words[0].slice(0, 4)
      : words.map((w) => w[0]).join('').slice(0, 4);
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function CreateProjectPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  // Subscribe to the role *value*, not the `isAdmin` helper: that function's
  // reference never changes, so selecting it means this component never
  // re-renders when the workspace payload arrives and would be stuck on the
  // pre-load default of 'member'.
  const workspaceRole = useCurrentWorkspaceStore((s) => s.myRole);
  const workspaceLoading = useCurrentWorkspaceStore((s) => s.isLoading);
  const canCreate = workspaceRole === 'owner' || workspaceRole === 'admin';
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [keyTouched, setKeyTouched] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', key: '', description: '' },
  });

  const { isSubmitting, errors } = form.formState;
  const nameValue = useWatch({ control: form.control, name: 'name' });
  const keyValue = useWatch({ control: form.control, name: 'key' });
  const effectiveKey = keyTouched ? keyValue || '' : suggestKey(nameValue || '');

  const onSubmit = async (values: Values) => {
    setSubmitError(null);
    const key = (keyTouched ? values.key : suggestKey(values.name)).toUpperCase();
    try {
      const project = await createProject(slug, { ...values, key });
      toast.success(`${project.key} created`);
      navigate(`/w/${slug}/projects/${project.key}`);
    } catch (err) {
      // 409 when the key is already used in this workspace.
      setSubmitError(err instanceof Error ? err.message : 'Could not create the project.');
    }
  };

  // Never rule on permissions before the role is known, or a direct visit to
  // this URL flashes a denial at someone who is actually allowed.
  if (workspaceLoading) {
    return (
      <PageShell narrow>
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="mt-6 h-72 w-full rounded-2xl" />
      </PageShell>
    );
  }

  if (!canCreate) {
    return (
      <PageShell narrow>
        {/* A permission boundary, not a failure — same treatment as the
            workspace settings page. */}
        <EmptyState
          icon={<LockIcon />}
          title="You do not have permission to create projects"
          description="Only workspace owners and admins can create projects. Ask an admin to create one for you."
        />
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader
        title="New project"
        description="The key prefixes every issue in this project and cannot be changed later."
      />

      {submitError ? (
        <ErrorState message={submitError} className="mb-6" />
      ) : null}

      <Card>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="p-name">Name</FieldLabel>
                <Input
                  id="p-name"
                  type="text"
                  placeholder="Frontend App"
                  aria-invalid={!!errors.name}
                  {...form.register('name')}
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.key}>
                <FieldLabel htmlFor="p-key">Key</FieldLabel>
                <Input
                  id="p-key"
                  type="text"
                  maxLength={10}
                  placeholder={suggestKey(nameValue || '') || 'FRON'}
                  className="font-mono uppercase"
                  aria-invalid={!!errors.key}
                  {...form.register('key', {
                    onChange: () => setKeyTouched(true),
                  })}
                />
                {errors.key ? (
                  <FieldError errors={[errors.key]} />
                ) : (
                  <FieldDescription>
                    {effectiveKey
                      ? `Issues will be numbered ${effectiveKey.toUpperCase()}-1, ${effectiveKey.toUpperCase()}-2, and so on.`
                      : 'Derived from the name if left blank. Permanent once set.'}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="p-description">Description</FieldLabel>
                <Textarea
                  id="p-description"
                  rows={3}
                  placeholder="Optional — what this project covers."
                  {...form.register('description')}
                />
              </Field>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Create project
                </Button>
                <Button asChild type="button" variant="ghost">
                  <Link to={`/w/${slug}/projects`}>Cancel</Link>
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
