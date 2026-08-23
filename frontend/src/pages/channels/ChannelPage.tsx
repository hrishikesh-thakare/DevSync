import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { HashIcon, MessageSquareIcon, SmilePlusIcon, XIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { socketClient } from '@/lib/socket';
import { initialsOf } from '@/lib/initials';
import { firstUrlIn } from '@/lib/messageLinks';
import { renderMarkdownMessage } from '@/lib/renderMarkdownMessage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/api';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentGroup
} from '@/components/ui/attachment';
import { FileTextIcon } from 'lucide-react';

const QUICK_REACTIONS = ['👍', '🎉', '👀', '✅', '❤️', '🚀'];

export function ChannelPage() {
  const { slug = '', channelId = '' } = useParams();
  const {
    channel,
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
  const [sending, setSending] = useState(false);
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

    socket.emit('join_room', room);
    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_reaction_added', onReactionAdded);
    socket.on('message_reaction_removed', onReactionRemoved);

    return () => {
      socket.emit('leave_room', room);
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_reaction_added', onReactionAdded);
      socket.off('message_reaction_removed', onReactionRemoved);
    };
  }, [channelId, onNewMessage, onMessageUpdated, onMessageDeleted, onReactionAdded, onReactionRemoved]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // `bodyText` is now HTML from the rich composer, so an "empty" check can't
  // be a bare `.trim()` — the composer itself already gates on Tiptap's own
  // `editor.isEmpty` before ever calling this, so a call reaching here with
  // no attachments always has real content. Returns whether it succeeded —
  // MessageComposer only clears the draft it just sent on `true`.
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
        <Skeleton className="mb-4 h-8 w-64 rounded-lg" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>{error ?? 'Channel not found.'}</AlertTitle>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Main conversation.
          `min-h-0` is what actually makes the message list scroll internally
          instead of the whole column growing past the viewport — a flex
          item's default min-height is `auto` ("never shrink below content
          size"), so without this a `flex-1 overflow-y-auto` child can never
          activate its own scrollbar. Without it the page itself scrolled
          instead, taking the composer down with it — not "sticky", the
          opposite of sticky. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-6 py-3">
          <HashIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h1 className="font-medium text-foreground">{channel.name}</h1>
          {channel.isAnnouncementOnly ? <Badge variant="outline">announcements</Badge> : null}
          {channel.description ? (
            <p className="ml-2 hidden min-w-0 truncate text-sm text-muted-foreground sm:block">
              {channel.description}
            </p>
          ) : null}
          <ChannelSettingsSheet slug={slug} channel={channel} />
        </header>

        <ScrollArea className="flex-1">
          {/* `pb-8` rather than `py-4` symmetrically: reactions render in
              normal flow now (see MessageRow below), but the last message's
              content can still sit close to this edge — kept for breathing
              room. */}
          <div className="px-6 pt-4 pb-8">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No messages yet. Say something.
              </p>
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
        <div className="sticky bottom-0 z-10 bg-background">
          <MessageComposer
            disabled={sending}
            placeholder={`Message #${channel.name}`}
            onSend={(bodyText, attachments) => submit(bodyText, attachments, null)}
          />
        </div>
      </div>

      {/* Thread panel */}
      {threadRoot ? (
        <aside className="flex min-h-0 w-96 min-w-0 shrink-0 flex-col border-l">
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <MessageSquareIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="font-medium text-foreground">Thread</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="Close thread"
              onClick={closeThread}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </header>

          <ScrollArea className="flex-1">
            <div className="px-4 pt-3 pb-8">
              <MessageRow
                slug={slug}
                message={threadRoot}
                currentUserId={me?.userId}
                compact
                onReact={(emoji) => void toggleReaction(threadRoot, emoji)}
              />
              <Separator className="my-3" />

              {isThreadLoading ? (
                <Skeleton className="h-16 w-full rounded-lg" />
              ) : threadReplies.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No replies yet.</p>
              ) : (
                <ul className="space-y-1">
                  {threadReplies.map((reply) => (
                    <MessageRow
                      slug={slug}
                      key={reply.messageId}
                      message={reply}
                      currentUserId={me?.userId}
                      compact
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

          <div className="sticky bottom-0 z-10 bg-background">
            <MessageComposer
              disabled={sending}
              placeholder="Reply in thread"
              onSend={(bodyText, attachments) => submit(bodyText, attachments, threadRoot.messageId)}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export interface AttachmentPayload {
  name: string;
  url?: string;
  sizeBytes: number;
  mimetype: string;
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
  // `bodyText` is markdown from the composer (plain `**bold**` syntax typed
  // into a textarea, not a rich-text editor's HTML) — converted to HTML and
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

  return (
    <>
      {showDate ? (
        <li className="my-3 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.createdAt), 'd MMMM yyyy')}
          </span>
          <Separator className="flex-1" />
        </li>
      ) : null}

      <li id={message.messageId} className={cn('group flex gap-3 rounded-lg px-2 py-1 hover:bg-accent/40', grouped && '-mt-1')}>
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

        <div className="min-w-0 flex-1">
          {!grouped ? (
            <p className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">
                {message.authorName ?? 'System'}
              </span>
              {message.isSystem ? <Badge variant="outline">system</Badge> : null}
              <span className="text-xs text-muted-foreground">
                {format(new Date(message.createdAt), 'HH:mm')}
              </span>
            </p>
          ) : null}

          <Bubble variant={getBubbleVariant(isMine, message.authorId)} className="mt-1">
            {message.bodyText && (
              <BubbleContent className="whitespace-pre-wrap">
                {/* A separate inner element, not dangerouslySetInnerHTML on
                    BubbleContent itself — React forbids mixing that prop with
                    ordinary children, and the "(edited)" marker needs to stay
                    a normal sibling node. whitespace-pre-wrap stays on the
                    outer element for legacy plain-text messages sent before
                    this feature existed: their literal '\n' characters still
                    need it, while Tiptap's own <p> tags create their visual
                    breaks regardless. */}
                <div
                  className="rich-message-content"
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
                <AttachmentGroup>
                  {message.bodyBlocks.map((b: unknown, idx) => {
                    const block = b as AttachmentPayload & { type: string };
                    if (block.type !== 'attachment') return null;
                    return (
                      <Attachment key={idx}>
                        <AttachmentMedia variant={block.mimetype?.startsWith('image/') ? 'image' : 'icon'}>
                          {block.mimetype?.startsWith('image/') ? <img src={block.url} alt="" /> : <FileTextIcon />}
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle>{block.name}</AttachmentTitle>
                          <AttachmentDescription>{Math.round(block.sizeBytes / 1024)} KB</AttachmentDescription>
                        </AttachmentContent>
                        {block.url && (
                          <AttachmentActions>
                            <AttachmentAction asChild aria-label={`Download ${block.name}`}>
                              <a href={block.url} target="_blank" rel="noopener noreferrer">
                                <FileTextIcon />
                              </a>
                            </AttachmentAction>
                          </AttachmentActions>
                        )}
                      </Attachment>
                    );
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
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {reactions.map(([emoji, info]) => (
                  <Tooltip key={emoji}>
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
                ))}
              </div>
            ) : null}
          </Bubble>

          {!compact && message.replyCount > 0 && onReply ? (
            <button
              type="button"
              onClick={onReply}
              className="mt-1 text-xs text-primary hover:underline"
            >
              {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          ) : null}
        </div>

        {/* Row actions, revealed on hover/focus */}
        <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Add reaction">
                <SmilePlusIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="flex min-w-0 gap-1 p-1">
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
      </li>
    </>
  );
}
