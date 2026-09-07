import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import {
  ChevronDownIcon,
  HashIcon,
  Loader2Icon,
  MessageSquareIcon,
  PhoneIcon,
  PhoneOffIcon,
  PlayIcon,
  SmilePlusIcon,
  XIcon,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, MessageSkeleton } from '@/components/layout/PageState';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkPreview } from '@/components/LinkPreview';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { ChannelSettingsSheet } from '@/pages/channels/ChannelSettingsSheet';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/auth';
import { useCurrentWorkspaceStore } from '@/store/currentWorkspace';
import { socketClient } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import type { MentionItem } from '@/components/editor/mentionSuggestion';
import { initialsOf } from '@/lib/initials';
import { firstUrlIn } from '@/lib/messageLinks';
import { renderMarkdownMessage } from '@/lib/renderMarkdownMessage';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/api';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  AttachmentGroup
} from '@/components/ui/attachment';
import { attachmentIcon, downloadAttachment, getFileVariant } from '@/lib/files';

const QUICK_REACTIONS = ['👍', '🎉', '👀', '✅', '❤️', '🚀'];

export function ChannelPage() {
  const { slug = '', channelId = '' } = useParams();
  const {
    channel,
    members,
    messages,
    threadRoot,
    threadReplies,
    isLoading,
    isThreadLoading,
    error,
    openChannel,
    send,
    remove,
    react,
    openThread,
    closeThread,
    onNewMessage,
    onMessageUpdated,
    onMessageDeleted,
    onReactionAdded,
    onReactionRemoved,
    reset,
  } = useChatStore();

  const me = useAuthStore((s) => s.user);

  // A dm/group_dm has no name — its identity is its participants, not a
  // settable string (see `Channel.name`'s doc comment). `members` is already
  // fetched for every channel (it backs the member list elsewhere), so the
  // real names are one filter away rather than a placeholder like "Direct
  // message" everywhere a real channel would show `#general`.
  const isDirect = channel?.type === 'dm' || channel?.type === 'group_dm';
  const directLabel = isDirect
    ? members.filter((m) => m.userId !== me?.userId).map((m) => m.displayName || m.fullName).join(', ') ||
      'Direct message'
    : null;

  // Resolved client-side from the sidebar's already-fetched project list —
  // no extra request. `null` for a channel with no linked project (or a DM),
  // which just means the composer's mention picker only ever offers people.
  const projects = useCurrentWorkspaceStore((s) => s.projects);
  const projectKey = channel?.projectId
    ? (projects.find((p) => p.projectId === channel.projectId)?.key ?? null)
    : null;

  // Backs the composer's `@` mention popup — user results are filtered
  // client-side from `members` (already loaded for this channel), task
  // results are a live search scoped to the channel's linked project, if it
  // has one. Fails soft to user-only results: a member without project
  // access, or a network hiccup, shouldn't block mentioning a person.
  const getMentionItems = async (query: string, signal: AbortSignal): Promise<MentionItem[]> => {
    const q = query.trim().toLowerCase();
    const userItems: MentionItem[] = members
      // Not yourself — you don't @-mention the person typing.
      .filter((m) => m.userId !== me?.userId)
      .filter((m) => !q || m.fullName.toLowerCase().includes(q) || (m.displayName ?? '').toLowerCase().includes(q))
      .slice(0, 6)
      .map((m) => ({ kind: 'user', id: m.userId, label: m.displayName || m.fullName, avatarUrl: m.avatarUrl }));

    if (!projectKey) return userItems;

    try {
      const data = await apiFetch(
        `/workspaces/${slug}/projects/${projectKey}/tasks?${q ? `search=${encodeURIComponent(q)}&` : ''}limit=6`,
        { signal },
      );
      const taskItems: MentionItem[] = (data.tasks ?? []).map(
        (t: { taskId: string; taskKey: string; title: string }) => ({
          kind: 'task' as const,
          id: t.taskId,
          taskKey: t.taskKey,
          title: t.title,
        }),
      );
      return [...userItems, ...taskItems];
    } catch {
      return userItems;
    }
  };

  const [sending, setSending] = useState(false);
  // The Zoom join link for this channel's live call, if any — `null` means
  // no call is running, so the header button reads "Start call". There is
  // no embed and no participant count: once someone clicks through, they've
  // left this page for Zoom's, which the backend has no visibility into.
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [startingCall, setStartingCall] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug && channelId) void openChannel(slug, channelId);
    return () => reset();
  }, [slug, channelId, openChannel, reset]);

  // Join the channel room and subscribe. The server only accepts room ids of
  // the form `channel:<uuid>` and answers a refusal with `room_join_denied`.
  useEffect(() => {
    if (!channelId) return;
    const socket = socketClient.getSocket();
    const room = `channel:${channelId}`;

    // The server replies to `join_room` with the call's current state (if
    // any) addressed only to this socket, and to a fresh `POST .../call`
    // from anyone with a room-wide broadcast — same event name either way,
    // so one listener covers both. `channelRoomId` is checked because this
    // socket may be joined to other channel rooms too (a background DM tab).
    const onCallStarted = (payload: { channelRoomId: string; joinUrl: string | null }) => {
      if (payload.channelRoomId === room) setCallUrl(payload.joinUrl);
    };

    // `joinRoom` returns its own release function and replays the join on
    // every reconnect — a bare `emit` here was lost the moment the socket
    // dropped, since this effect does not re-run on reconnect.
    const releaseRoom = socketClient.joinRoom(room);
    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_reaction_added', onReactionAdded);
    socket.on('message_reaction_removed', onReactionRemoved);
    socket.on('call_started', onCallStarted);

    return () => {
      releaseRoom();
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_reaction_added', onReactionAdded);
      socket.off('message_reaction_removed', onReactionRemoved);
      socket.off('call_started', onCallStarted);
      setCallUrl(null);
    };
  }, [channelId, onNewMessage, onMessageUpdated, onMessageDeleted, onReactionAdded, onReactionRemoved]);

  // Opens the shared Zoom link in a new tab — minting one first via the
  // backend if this is the first person in the channel to click it this
  // "session" (the backend reuses the existing meeting for everyone after).
  const handleCall = async () => {
    if (callUrl) {
      window.open(callUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setStartingCall(true);
    try {
      const { joinUrl } = await apiFetch(`/workspaces/${slug}/channels/${channelId}/call`, { method: 'POST' });
      setCallUrl(joinUrl);
      window.open(joinUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start the call.');
    } finally {
      setStartingCall(false);
    }
  };

  // Force-ends the Zoom meeting for everyone, not just this tab — there's no
  // "leave" concept here (closing the Zoom tab already does that); this is
  // specifically for closing out a call nobody's using any more so the next
  // click starts a fresh one instead of rejoining a stale meeting.
  const handleEndCall = async () => {
    const previousUrl = callUrl;
    setCallUrl(null); // optimistic — the DELETE below can't really fail in a way worth reverting for
    try {
      await apiFetch(`/workspaces/${slug}/channels/${channelId}/call`, { method: 'DELETE' });
    } catch (err) {
      setCallUrl(previousUrl);
      toast.error(err instanceof Error ? err.message : 'Could not end the call.');
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // `bodyText` is markdown from the composer (`RichTextEditor`'s wire format
  // — see that component's doc comment), trimmed there before this is ever
  // called; the composer itself already gates on the editor's own `isEmpty`
  // before calling `onSend`, so a call reaching here with no attachments
  // always has real content. Returns whether it succeeded — MessageComposer
  // only clears the draft it just sent on `true`.
  const submit = async (
    body: string,
    attachments: AttachmentPayload[],
    threadId: string | null,
  ): Promise<boolean> => {
    if (!body && attachments.length === 0) return false;
    setSending(true);
    try {
      await send(slug, channelId, body, threadId, attachments);
      return true;
    } catch (err) {
      // 403 in an announcement-only channel when the sender is not an admin.
      toast.error(err instanceof Error ? err.message : 'Could not send the message.');
      return false;
    } finally {
      setSending(false);
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    const mine = message.reactions.some((r) => r.userId === me?.userId && r.emoji === emoji);
    try {
      await react(slug, channelId, message.messageId, emoji, !mine);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not react.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <MessageSkeleton />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="p-6">
        <ErrorState message={error ?? 'Channel not found.'} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Main conversation.
          `min-h-0` is what actually makes the message list scroll internally
          instead of the whole column growing past the viewport — a flex
          item's default min-height is `auto` ("never shrink below content
          size"), so without this a `flex-1 overflow-y-auto` child can never
          activate its own scrollbar. Without it the page itself scrolled
          instead, taking the composer down with it — not "sticky", the
          opposite of sticky. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-6">
          {isDirect ? (
            <MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <HashIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <h1 className="font-medium text-foreground">{isDirect ? directLabel : channel.name}</h1>
          {channel.isAnnouncementOnly ? <Badge variant="outline">announcements</Badge> : null}
          {channel.description ? (
            <p className="ml-2 hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {channel.description}
            </p>
          ) : null}
          {callUrl ? (
            // Split button: the main half still does the obvious thing on a
            // plain click (join); ending the call for everyone is one level
            // deeper, in the chevron's menu, since it's the more disruptive
            // of the two actions and shouldn't share a hit target with it.
            <ButtonGroup className="ml-auto">
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void handleCall()}>
                <PhoneIcon className="size-3.5" aria-hidden="true" />
                Join call
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" aria-label="Call options">
                    <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => void handleEndCall()}>
                    <PhoneOffIcon className="size-3.5" aria-hidden="true" />
                    End call for everyone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              disabled={startingCall}
              onClick={() => void handleCall()}
            >
              {startingCall ? (
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <PhoneIcon className="size-3.5" aria-hidden="true" />
              )}
              Start call
            </Button>
          )}
          <ChannelSettingsSheet slug={slug} channel={channel} />
        </header>

        {/* `min-h-0` on the ScrollArea itself, not just its ancestors: a flex
            item's default min-height is `auto` ("never shrink below content
            size"), and Radix's ScrollAreaPrimitive.Root doesn't override it —
            without this, `flex-1` alone still lets it grow to fit every
            message rather than clamp to the available space, so `<main>`'s
            own overflow-y-auto ends up scrolling everything (header
            included) instead of this list scrolling internally. */}
        <ScrollArea className="min-h-0 flex-1">
          {/* `pb-8` rather than `py-4` symmetrically: reactions render in
              normal flow now (see MessageRow below), but the last message's
              content can still sit close to this edge — kept for breathing
              room. */}
          <div className="flex flex-col justify-end min-h-full px-6 pt-4 pb-8">
            {messages.length === 0 ? (
              <EmptyState
                compact
                icon={<MessageSquareIcon />}
                title="No messages yet"
                description="Start the conversation — everyone in this channel will see it."
              />
            ) : (
              <ul className="space-y-1">
                {messages.map((message, i) => (
                  <MessageRow
                    slug={slug}
                    key={message.messageId}
                    message={message}
                    previous={messages[i - 1]}
                    currentUserId={me?.userId}
                    onReply={() => void openThread(slug, channelId, message)}
                    onReact={(emoji) => void toggleReaction(message, emoji)}
                    onDelete={() => {
                      void remove(slug, channelId, message.messageId).catch((err: unknown) =>
                        toast.error(err instanceof Error ? err.message : 'Could not delete.'),
                      );
                    }}
                  />
                ))}
              </ul>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Explicit `sticky` on top of the `min-h-0` fix above, belt-and-
            braces: once the message list is correctly height-capped this is
            already pinned by ordinary flex layout, but sticky costs nothing
            extra and holds even if some future change reintroduces page-level
            scrolling here. */}
        {/* No bar/border/background of its own any more — the composer
            (`RichTextEditor`) is its own floating, elevated, heavily rounded
            card now, so this just needs to be a plain sticky spacer that lets
            the message area's background show through around it. */}
        <div className="sticky bottom-0 z-10">
          <MessageComposer
            slug={slug}
            disabled={sending}
            placeholder={isDirect ? `Message ${directLabel}` : `Message #${channel.name}`}
            onSend={(bodyText, attachments) => submit(bodyText, attachments, null)}
            getMentionItems={getMentionItems}
          />
        </div>
      </div>

      {/* Thread panel */}
      {threadRoot ? (
        <aside className="flex min-h-0 w-96 min-w-0 shrink-0 flex-col border-l bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-medium text-foreground">Thread</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label="Close thread"
              onClick={closeThread}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </header>

          {/* `min-h-0` on the ScrollArea itself, not just its ancestors: a flex
            item's default min-height is `auto` ("never shrink below content
            size"), and Radix's ScrollAreaPrimitive.Root doesn't override it —
            without this, `flex-1` alone still lets it grow to fit every
            message rather than clamp to the available space, so `<main>`'s
            own overflow-y-auto ends up scrolling everything (header
            included) instead of this list scrolling internally. */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col justify-end min-h-full px-4 pt-3 pb-8">
              <MessageRow
                slug={slug}
                message={threadRoot}
                currentUserId={me?.userId}
                onReact={(emoji) => void toggleReaction(threadRoot, emoji)}
              />
              <Separator className="my-3" />

              {isThreadLoading ? (
                <Skeleton className="h-16 w-full rounded-lg" />
              ) : threadReplies.length === 0 ? (
                <EmptyState compact title="No replies yet" description="Reply to start the thread." />
              ) : (
                <ul className="space-y-1">
                  {threadReplies.map((reply, i) => (
                    <MessageRow
                      slug={slug}
                      key={reply.messageId}
                      message={reply}
                      previous={i > 0 ? threadReplies[i - 1] : undefined}
                      currentUserId={me?.userId}
                      onReact={(emoji) => void toggleReaction(reply, emoji)}
                      onDelete={() => {
                        void remove(slug, channelId, reply.messageId).catch((err: unknown) =>
                          toast.error(err instanceof Error ? err.message : 'Could not delete.'),
                        );
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          {/* No bar/border/background of its own any more — the composer
            (`RichTextEditor`) is its own floating, elevated, heavily rounded
            card now, so this just needs to be a plain sticky spacer that lets
            the message area's background show through around it. */}
        <div className="sticky bottom-0 z-10">
            <MessageComposer
              slug={slug}
              disabled={sending}
              placeholder="Reply in thread"
              onSend={(bodyText, attachments) => submit(bodyText, attachments, threadRoot.messageId)}
              getMentionItems={getMentionItems}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export interface AttachmentPayload {
  name: string;
  /**
   * Stable reference to the uploaded file — the message stores this, and
   * the URL is resolved fresh (short-lived, revocable) each time the
   * message renders. This is what every new attachment carries.
   */
  fileId?: string;
  /**
   * A URL baked directly into the message at send time. This is the OLD
   * format (see git history around the file-serving JWT fix) — a signed
   * URL good for ten years, stored verbatim. Kept only so messages sent
   * before that fix still render; nothing writes this field anymore.
   */
  url?: string;
  sizeBytes: number;
  mimetype: string;
}

/**
 * Renders one chat attachment. New-format blocks (`fileId`, no `url`) fetch a
 * fresh, short-lived download URL on mount rather than trusting anything
 * baked into the message — a leaked chat link now expires like any other
 * signed URL instead of working for ten years. Old messages (`url` already
 * set, sent before this fix) just use that URL directly; there's nothing to
 * re-resolve for them, and no way to retroactively shorten a URL that's
 * already been handed out.
 */
function ChatAttachmentBlock({
  slug,
  block,
}: {
  slug: string;
  block: AttachmentPayload & { type: string };
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(block.url ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (block.url || !block.fileId) return;
    let cancelled = false;
    apiFetch(`/workspaces/${slug}/files/${block.fileId}/download`)
      .then((data) => {
        if (!cancelled) setResolvedUrl(data.downloadUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, block.fileId, block.url]);

  const variant = getFileVariant(block.mimetype, block.name);

  // Audio has nothing to enlarge — it stays inline with its native control
  // bar, same card shell as everything else. No filename/size caption: a
  // voice note doesn't carry a name worth reading, same reasoning as
  // WhatsApp/Slack voice messages — that caption only earns its keep on the
  // chip below, where the name (a real document/code filename) is the point.
  if (resolvedUrl && variant === 'audio') {
    return (
      <Attachment orientation="vertical" className="w-72! overflow-hidden">
        <div className="w-full p-2">
          <audio controls src={resolvedUrl} className="w-full" />
        </div>
      </Attachment>
    );
  }

  // Video and images open a fullscreen viewer on click, WhatsApp-style — the
  // inline card is a preview, not the actual player. A `<video controls>`
  // inline would fight a whole-card click handler (every scrub/pause would
  // also trigger it), so the inline preview is a muted, controls-less frame
  // with a Play badge; the real player — controls, unmuted, autoplay — only
  // exists inside the dialog. `AttachmentTrigger` is the same overlay-button
  // this component already uses for the pdf/download case, just wired to a
  // dialog instead of a link, so it's fully keyboard/focus accessible.
  if (resolvedUrl && (variant === 'video' || variant === 'image')) {
    return (
      <Attachment orientation="vertical" className="w-72! overflow-hidden">
        <div className="relative w-full bg-black">
          {variant === 'video' ? (
            <>
              <video src={resolvedUrl} preload="metadata" muted playsInline className="max-h-80 w-full object-contain" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
                  <PlayIcon className="size-6 translate-x-0.5" />
                </span>
              </span>
            </>
          ) : (
            <img src={resolvedUrl} alt="" className="max-h-80 w-full object-cover" />
          )}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <AttachmentTrigger aria-label={variant === 'video' ? `Play ${block.name}` : `View ${block.name}`} />
          </DialogTrigger>
          <DialogContent
            // The close button sits over the video's own native controls
            // (which already include play/pause/fullscreen and their own
            // exit-fullscreen affordance) — dropped for video specifically.
            // Esc and clicking the backdrop still close the dialog either
            // way. Images keep it since there's no native chrome to clash with.
            showCloseButton={variant !== 'video'}
            className="flex w-fit max-w-[95vw] items-center justify-center border-none bg-transparent p-0 shadow-none ring-0"
          >
            <DialogTitle className="sr-only">{block.name}</DialogTitle>
            {variant === 'video' ? (
              <video src={resolvedUrl} controls autoPlay className="max-h-[88vh] max-w-[90vw] rounded-lg" />
            ) : (
              <img src={resolvedUrl} alt="" className="max-h-[88vh] max-w-[90vw] rounded-lg object-contain" />
            )}
          </DialogContent>
        </Dialog>
      </Attachment>
    );
  }

  // Not yet resolved, failed, or a non-inline type (pdf/code/other) — the
  // compact chip, same shape it's always been.
  return (
    <Attachment orientation="horizontal">
      <AttachmentMedia variant={variant}>
        {/* `createElement`, not a `const Icon = attachmentIcon(...)` local
            rendered as `<Icon/>` — that shape reads as "a component created
            during render" to the react-compiler lint rule, even though
            `attachmentIcon` only ever returns one of three fixed,
            module-level icon components. This sidesteps the false positive
            without disabling the rule. */}
        {createElement(attachmentIcon(block.mimetype))}
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{block.name}</AttachmentTitle>
        <AttachmentDescription>
          {failed ? 'Could not load this file' : `${Math.round(block.sizeBytes / 1024)} KB`}
        </AttachmentDescription>
      </AttachmentContent>
      {resolvedUrl && (
        <AttachmentTrigger asChild aria-label={`Open ${block.name}`}>
          <a
            href={resolvedUrl}
            target={variant === 'pdf' ? '_blank' : undefined}
            rel="noopener noreferrer"
            onClick={(e) => {
              // PDF opens normally — the server answers it `inline` and the
              // tab renders a real PDF viewer. Everything else here (code,
              // archives, office docs) the server forces to `attachment`, so
              // a `target="_blank"` link just leaves an empty tab behind
              // once the download starts. Download directly instead.
              if (variant === 'pdf') return;
              e.preventDefault();
              downloadAttachment(resolvedUrl, block.name);
            }}
          />
        </AttachmentTrigger>
      )}
    </Attachment>
  );
}

const OTHER_USER_VARIANTS = ["blue", "green", "amber", "purple", "pink", "teal"] as const;

function getBubbleVariant(isMine: boolean, authorId: string | null) {
  if (isMine) return "default";
  if (!authorId) return "secondary";
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % OTHER_USER_VARIANTS.length;
  return OTHER_USER_VARIANTS[index];
}

function MessageRow({
  slug,
  message,
  previous,
  currentUserId,
  compact,
  onReply,
  onReact,
  onDelete,
}: {
  slug: string;
  message: ChatMessage;
  previous?: ChatMessage;
  currentUserId?: string;
  compact?: boolean;
  onReply?: () => void;
  onReact: (emoji: string) => void;
  onDelete?: () => void;
}) {
  // Group consecutive messages from the same author within the same day.
  const grouped =
    !compact &&
    previous &&
    previous.authorId === message.authorId &&
    !previous.isSystem &&
    !message.isSystem &&
    isSameDay(new Date(previous.createdAt), new Date(message.createdAt));

  const showDate =
    !compact &&
    (!previous || !isSameDay(new Date(previous.createdAt), new Date(message.createdAt)));

  const linkedUrl = useMemo(() => firstUrlIn(message.bodyText ?? ''), [message.bodyText]);
  // `bodyText` is markdown (`**bold**` syntax) — the composer is a rich-text
  // editor (`RichTextEditor`, Tiptap), but its wire format is still markdown,
  // not HTML, so this render path is unchanged: converted to HTML and
  // sanitized in one step; see `e2e/tests/channels/messages.spec.ts`'s "XSS
  // sanitization" suite for exactly what has to survive that inert.
  const safeBodyHtml = useMemo(() => renderMarkdownMessage(message.bodyText ?? ''), [message.bodyText]);

  // Collapse the flat reaction rows into counts per emoji.
  const reactions = useMemo(() => {
    const byEmoji = new Map<string, { count: number; mine: boolean; who: string[] }>();
    for (const r of message.reactions ?? []) {
      const entry = byEmoji.get(r.emoji) ?? { count: 0, mine: false, who: [] };
      entry.count += 1;
      if (r.userId === currentUserId) entry.mine = true;
      if (r.userName) entry.who.push(r.userName);
      byEmoji.set(r.emoji, entry);
    }
    return [...byEmoji.entries()];
  }, [message.reactions, currentUserId]);

  const isMine = message.authorId === currentUserId;
  const isOptimistic = message.messageId.startsWith('optimistic-');

  return (
    <>
      {showDate ? (
        <li className="my-4 flex justify-center">
          <span className="rounded-full bg-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            {format(new Date(message.createdAt), 'd MMMM yyyy')}
          </span>
        </li>
      ) : null}

      <li id={message.messageId} className={cn('group flex gap-3 rounded-lg px-2 py-1 hover:bg-accent/40', grouped && '-mt-1', isMine && 'flex-row-reverse', isOptimistic && 'opacity-60')}>
        <div className="w-7 shrink-0">
          {!grouped ? (
             <Avatar className="size-7">
              {message.authorAvatar ? <AvatarImage src={message.authorAvatar} alt="" /> : null}
              <AvatarFallback className="text-[10px]">
                {initialsOf(message.authorName ?? 'System')}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>

        <div className={cn("min-w-0 flex-1 flex flex-col", isMine ? "items-end" : "items-start")}>
          {!grouped ? (
            <p className={cn("flex items-baseline gap-2", isMine && "flex-row-reverse")}>
              <span className="text-sm font-medium text-foreground">
                {message.authorName ?? 'System'}
              </span>
              {message.isSystem ? <Badge variant="outline">system</Badge> : null}
              <span className="text-xs text-muted-foreground">
                {isOptimistic ? 'Sending...' : format(new Date(message.createdAt), 'HH:mm')}
              </span>
            </p>
          ) : null}

          <Bubble variant={getBubbleVariant(isMine, message.authorId)} align={isMine ? 'end' : 'start'} className="mt-1">
            {message.bodyText && (
              <BubbleContent>
                {/* A separate inner element, not dangerouslySetInnerHTML on
                    BubbleContent itself — React forbids mixing that prop with
                    ordinary children, and the "(edited)" marker needs to stay
                    a normal sibling node. We previously used whitespace-pre-wrap
                    here, but marked's output already contains <p> and <br> tags
                    for line breaks, and preserving raw \n caused huge gaps. */}
                <div
                  className={cn(
                    // `overflow-wrap:anywhere` is the actual fix, same
                    // reasoning as `RichTextEditor.tsx`'s `EDITOR_CONTENT_CLASS`:
                    // a message with no spaces at all (a wall of the same
                    // character, a long hash/URL) has no break opportunity,
                    // so its intrinsic width just keeps growing — `max-w-[80%]`
                    // on `Bubble` doesn't stop that, a max-width only caps a
                    // box that's *able* to shrink. That growth was pushing the
                    // whole page into horizontal scroll on every load of any
                    // channel containing such a message, not just while
                    // composing one.
                    "rich-message-content min-w-0 overflow-x-hidden",
                    '[&_p]:m-0 [&_p]:[overflow-wrap:anywhere] [&_p+p]:mt-2',
                    '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
                    '[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
                    '[&_code]:rounded [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]',
                    '[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/10 dark:[&_pre]:bg-white/10 [&_pre]:p-2',
                    '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
                    '[&_a]:underline [&_a]:underline-offset-2',
                    // Matches `RichTextEditor.tsx`'s composer-time styling for
                    // the same `span[data-type="mention"]` the Mention
                    // extension serializes to — see that file's comment for
                    // why this exact markup survives sanitization. Background
                    // is a `currentColor` mix rather than a fixed `bg-primary`
                    // — confirmed live that a fixed primary tint is invisible
                    // on an own-message bubble, which is *already*
                    // `bg-primary text-primary-foreground` (`bubble.tsx`'s
                    // `default` variant): primary-on-primary. Deriving from
                    // `currentColor` means the chip always contrasts against
                    // whatever text color the surrounding bubble variant set,
                    // own message or not.
                    '[&_span[data-type="mention"]]:rounded [&_span[data-type="mention"]]:px-1 [&_span[data-type="mention"]]:py-0.5 [&_span[data-type="mention"]]:font-semibold [&_span[data-type="mention"]]:bg-[color-mix(in_srgb,currentColor_18%,transparent)]'
                  )}
                  dangerouslySetInnerHTML={{ __html: safeBodyHtml }}
                />
                {message.isEdited ? (
                  <span className="ml-1 text-xs opacity-70">(edited)</span>
                ) : null}
              </BubbleContent>
            )}

            {/* Only the first link is unfurled: the endpoint fetches the target
                page server-side with a 5s timeout, so one request per message
                is the sensible ceiling. */}
            {linkedUrl ? <LinkPreview slug={slug} url={linkedUrl} /> : null}

            {Array.isArray(message.bodyBlocks) && message.bodyBlocks.length > 0 && (
              <div className="mt-2 px-1">
                {/* `items-start`: the group's own default is `stretch`,
                    which pads a small horizontal file card up to match a
                    tall image card in the same row (empty space around a
                    centered icon) — only images are meant to be big. */}
                <AttachmentGroup className="items-start">
                  {message.bodyBlocks.map((b: unknown, idx) => {
                    const block = b as AttachmentPayload & { type: string };
                    if (block.type !== 'attachment') return null;
                    return <ChatAttachmentBlock key={idx} slug={slug} block={block} />;
                  })}
                </AttachmentGroup>
              </div>
            )}

            {reactions.length > 0 ? (
              // A normal-flow row, not the absolutely-positioned
              // `BubbleReactions` overlay: `position: absolute` needs a
              // reliably-positioned ancestor, and on grouped consecutive
              // messages (author+day repeated, `-mt-1` applied to tighten
              // spacing) the pill could end up resolving against the wrong
              // one — visually a reaction pill floating disconnected from
              // any bubble, which is what got reported. Normal flow can't
              // do that: it renders exactly where it sits in the DOM,
              // directly under the message it belongs to.
              <div className={cn("mt-1.5 flex flex-wrap items-center gap-1", isMine && "justify-end")}>
                {reactions.map(([emoji, info]) => (
                  <TooltipProvider key={emoji}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onReact(emoji)}
                          className={cn(
                            'flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs shadow-sm transition-colors hover:bg-muted',
                            info.mine ? 'border-primary/50 text-primary font-medium' : 'text-muted-foreground',
                          )}
                        >
                          <span>{emoji}</span>
                          <span>{info.count}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{info.who.join(', ')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ) : null}
          </Bubble>

          {!compact && message.replyCount > 0 && onReply ? (
            <button
              type="button"
              onClick={onReply}
              className={cn("mt-1 text-xs text-primary hover:underline", isMine && "self-end")}
            >
              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          ) : null}
        </div>

        {/* Row actions, revealed on hover/focus */}
        {!isOptimistic && (
          <div className={cn("flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100", isMine && "flex-row-reverse")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="Add reaction">
                  <SmilePlusIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="flex w-fit gap-1 p-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded p-1 text-base hover:bg-accent"
                    onClick={() => onReact(emoji)}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {onReply && !compact ? (
              <Button variant="ghost" size="icon-xs" aria-label="Reply in thread" onClick={onReply}>
                <MessageSquareIcon className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}

            {isMine && onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label="Message actions">
                    <span aria-hidden="true">⋯</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onDelete}>Delete message</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}
      </li>
    </>
  );
}
