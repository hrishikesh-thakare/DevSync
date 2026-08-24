import { useMemo, useState } from 'react';
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

const ANY = '__any__';

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

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(ANY);
  const [projectFilter, setProjectFilter] = useState(ANY);

  const hasFilters = search.trim() !== '' || typeFilter !== ANY || projectFilter !== ANY;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return channels.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q)) &&
        (typeFilter === ANY || c.type === typeFilter) &&
        (projectFilter === ANY ||
          (projectFilter === '__workspace__' ? !c.projectId : c.projectId === projectFilter)),
    );
  }, [channels, search, typeFilter, projectFilter]);

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
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name"
              aria-label="Filter channels"
              className="max-w-xs"
            />

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36" aria-label="Filter by visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All types</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-48" aria-label="Filter by project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All channels</SelectItem>
                <SelectItem value="__workspace__">Workspace-wide</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.projectId} value={p.projectId}>
                    {p.key} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTypeFilter(ANY);
                  setProjectFilter(ANY);
                }}
              >
                Clear filters
              </Button>
            ) : null}

            <p className="ml-auto text-xs text-muted-foreground">
              {visible.length === channels.length
                ? `${channels.length} channels`
                : `${visible.length} of ${channels.length} channels`}
            </p>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<HashIcon aria-hidden="true" />}
              title="No channels match these filters"
              description="Try clearing a filter or searching for something else."
            />
          ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((channel) => (
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
        </>
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
