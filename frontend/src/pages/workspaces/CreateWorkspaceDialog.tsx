import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2Icon, PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** Mirrors `createWorkspaceSchema` — name required, slug optional. */
const schema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens only')
    .optional(),
  description: z.string().trim().optional(),
});

type Values = z.infer<typeof schema>;

/** Turns "Acme Engineering" into "acme-engineering" for the slug preview. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const navigate = useNavigate();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', description: '' },
  });

  const { isSubmitting, errors } = form.formState;
  const nameValue = useWatch({ control: form.control, name: 'name' });
  const slugValue = useWatch({ control: form.control, name: 'slug' });
  const effectiveSlug = slugValue || slugify(nameValue || '');

  const onSubmit = async (values: Values) => {
    setSubmitError(null);
    try {
      const created = await createWorkspace({
        name: values.name,
        slug: values.slug || slugify(values.name),
        description: values.description,
      });
      setOpen(false);
      form.reset();
      navigate(`/w/${created.slug}`);
    } catch (err) {
      // 409 means the slug is taken — the most common failure by far.
      setSubmitError(err instanceof Error ? err.message : 'Could not create the workspace.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setSubmitError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="size-4" aria-hidden="true" />
          New Workspace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Workspaces hold your projects, channels and members. You&apos;ll be its owner.
          </DialogDescription>
        </DialogHeader>

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>{submitError}</AlertTitle>
          </Alert>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="ws-name">Name</FieldLabel>
              <Input
                id="ws-name"
                type="text"
                placeholder="Acme Engineering"
                aria-invalid={!!errors.name}
                {...form.register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.slug}>
              <FieldLabel htmlFor="ws-slug">URL slug</FieldLabel>
              <Input
                id="ws-slug"
                type="text"
                placeholder={slugify(nameValue || '') || 'acme-engineering'}
                aria-invalid={!!errors.slug}
                {...form.register('slug')}
              />
              {errors.slug ? (
                <FieldError errors={[errors.slug]} />
              ) : (
                <FieldDescription>
                  {effectiveSlug ? `Your workspace will live at /w/${effectiveSlug}` : 'Derived from the name if left blank.'}
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="ws-description">Description</FieldLabel>
              <Input
                id="ws-description"
                type="text"
                placeholder="Optional"
                {...form.register('description')}
              />
            </Field>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                Create workspace
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
