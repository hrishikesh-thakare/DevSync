import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { HashIcon, LockIcon, PlusIcon } from 'lucide-react';

import { EmptyState } from '@/components/layout/PageState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { PageHeader, PageShell } from '@/components/layout/PageHeader';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import type { ChannelType } from '@/types/api';

export function ChannelListPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { channels, projects, isAdmin, createChannel } = useCurrentWorkspaceStore();
  const canCreate = isAdmin();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('public');
  const [projectId, setProjectId] = useState('__none__');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const channel = await createChannel(
        slug,
        name.trim(),
        type,
        projectId === '__none__' ? null : projectId,
      );
      setOpen(false);
      setName('');
      toast.success(`#${channel.name} created`);
      navigate(`/w/${slug}/channels/${channel.channelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the channel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Channels"
        description="Workspace-wide rooms and project-scoped discussions."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <PlusIcon className="size-4" aria-hidden="true" />
              New channel
            </Button>
          ) : null
        }
      />

      {channels.length === 0 ? (
        <EmptyState
          icon={<HashIcon aria-hidden="true" />}
          title="No channels yet"
          description="Channels are where discussion happens, workspace-wide or scoped to a project."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <li key={channel.channelId}>
              <Link
                to={`/w/${slug}/channels/${channel.channelId}`}
                className="flex items-center gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/5 transition-shadow hover:ring-ring/40"
              >
                {channel.type === 'private' ? (
                  <LockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <HashIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{channel.name}</span>
                {channel.projectId ? <Badge variant="outline">project</Badge> : null}
                {channel.isAnnouncementOnly ? <Badge variant="secondary">announce</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New channel</DialogTitle>
            <DialogDescription>
              Public channels are open to every workspace member. Private ones are invite-only.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="c-name">Name</FieldLabel>
              <Input
                id="c-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="design-reviews"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="c-type">Visibility</FieldLabel>
              <Select value={type} onValueChange={(v) => setType(v as ChannelType)}>
                <SelectTrigger id="c-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="c-project">Project</FieldLabel>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="c-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Workspace-wide</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.projectId} value={p.projectId}>
                      {p.key} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <DialogFooter>
              <Button onClick={() => void create()} disabled={!name.trim() || saving}>
                Create channel
              </Button>
            </DialogFooter>
          </FieldGroup>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
