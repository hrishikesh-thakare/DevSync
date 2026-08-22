import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTaskStore } from '@/store/taskStore';
import { useProjectStore } from '@/store/projectStore';
import {
  ISSUE_TYPE_META,
  ISSUE_TYPE_ORDER,
  PRIORITY_META,
  PRIORITY_ORDER,
  STATUS_META,
} from '@/lib/taskMeta';
import type { IssueType, TaskPriority, TaskStatus } from '@/types/api';

const UNASSIGNED = '__none__';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  descriptionText: z.string().trim().optional(),
  storyPoints: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 100), 'A whole number from 0 to 100'),
});

type Values = z.infer<typeof schema>;

export function CreateTaskDialog({
  slug,
  projectKey,
  open,
  status,
  onOpenChange,
}: {
  slug: string;
  projectKey: string;
  open: boolean;
  status: TaskStatus;
  onOpenChange: (open: boolean) => void;
}) {
  const createTask = useTaskStore((s) => s.createTask);
  const members = useProjectStore((s) => s.members);

  const [issueType, setIssueType] = useState<IssueType>('task');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', descriptionText: '', storyPoints: '' },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: Values) => {
    setSubmitError(null);
    try {
      // createTaskSchema is .strict(): send only keys it declares, and omit
      // rather than send empty strings.
      const task = await createTask(slug, projectKey, {
        title: values.title,
        status,
        issueType,
        priority,
        ...(values.descriptionText ? { descriptionText: values.descriptionText } : {}),
        ...(values.storyPoints ? { storyPoints: Number(values.storyPoints) } : {}),
        ...(assigneeId !== UNASSIGNED ? { assigneeId } : {}),
      });
      toast.success(`${task.taskKey} created`);
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create the task.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Created in {STATUS_META[status].label}. The key is assigned automatically.
          </DialogDescription>
        </DialogHeader>

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>{submitError}</AlertTitle>
          </Alert>
        ) : null}

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="t-title">Title</FieldLabel>
              <Input
                id="t-title"
                type="text"
                autoFocus
                placeholder="Describe the work"
                aria-invalid={!!errors.title}
                {...form.register('title')}
              />
              <FieldError errors={[errors.title]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="t-type">Type</FieldLabel>
                <Select value={issueType} onValueChange={(v) => setIssueType(v as IssueType)}>
                  <SelectTrigger id="t-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ISSUE_TYPE_META[t].glyph} {ISSUE_TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="t-priority">Priority</FieldLabel>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger id="t-priority" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="t-assignee">Assignee</FieldLabel>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger id="t-assignee" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.displayName || m.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={!!errors.storyPoints}>
                <FieldLabel htmlFor="t-points">Story points</FieldLabel>
                <Input
                  id="t-points"
                  type="text"
                  inputMode="numeric"
                  placeholder="Optional"
                  aria-invalid={!!errors.storyPoints}
                  {...form.register('storyPoints')}
                />
                <FieldError errors={[errors.storyPoints]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="t-desc">Description</FieldLabel>
              <Textarea id="t-desc" rows={3} placeholder="Optional" {...form.register('descriptionText')} />
            </Field>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
                Create task
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Assignee options are the project members; unassigned uses a sentinel because
 *  Radix Select cannot hold an empty-string value. */
export { UNASSIGNED };
