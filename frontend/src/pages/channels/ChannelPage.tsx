import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { toast } from 'sonner';
import { HashIcon, Loader2Icon, MessageSquareIcon, SendIcon, SmilePlusIcon, XIcon } from 'lucide-react';

import { Alert, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LinkPreview } from '@/components/LinkPreview';
import { ChannelSettingsSheet } from '@/pages/channels/ChannelSettingsSheet';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/auth';
import { socketClient } from '@/lib/socket';
import { initialsOf } from '@/lib/initials';
import { firstUrlIn } from '@/lib/messageLinks';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/api';
import { Bubble, BubbleContent, BubbleReactions } from '@/components/ui/bubble';
import { supabase } from '@/lib/supabase';
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
import { PaperclipIcon, FileTextIcon } from 'lucide-react';

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
  const [draft, setDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
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

  const submit = async (body: string, attachments: AttachmentPayload[], threadId: string | null, clear: () => void) => {
    const text = body.trim();
    if (!text && attachments.length === 0) return;
    setSending(true);
    try {
      await send(slug, channelId, text, threadId, attachments);
      clear();
    } catch (err) {
      // 403 in an announcement-only channel when the sender is not an admin.
      toast.error(err instanceof Error ? err.message : 'Could not send the message.');
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
      {/* Main conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
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

          <Composer
            value={draft}
            onChange={setDraft}
            disabled={sending}
            placeholder={`Message #${channel.name}`}
            onSubmit={(attachments) => void submit(draft, attachments, null, () => setDraft(''))}
          />
        </div>

        {/* Thread panel */}
        {threadRoot ? (
          <aside className="flex w-96 min-w-0 shrink-0 flex-col border-l">
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

            <div className="flex-1 overflow-y-auto px-4 py-3">
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

            <Composer
              value={replyDraft}
              onChange={setReplyDraft}
              disabled={sending}
              placeholder="Reply in thread"
              onSubmit={(attachments) =>
                void submit(replyDraft, attachments, threadRoot.messageId, () => setReplyDraft(''))
              }
            />
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

function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (attachments: AttachmentPayload[]) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [attachments, setAttachments] = useState<{ id: string; name: string; sizeBytes: number; state: 'uploading' | 'done' | 'error'; url?: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newAttachments = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      sizeBytes: file.size,
      type: file.type,
      state: 'uploading' as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attId = newAttachments[i].id;
      try {
        const filePath = `uploads/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('workspaces').upload(filePath, file);
        if (error) throw error;
        
        const { data: urlData } = supabase.storage.from('workspaces').getPublicUrl(filePath);
        
        setAttachments((prev) => prev.map(a => a.id === attId ? { ...a, state: 'done', url: urlData.publicUrl } : a));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error(`Upload failed: ${message}`);
        setAttachments((prev) => prev.map(a => a.id === attId ? { ...a, state: 'error' } : a));
      }
    }
    
    // Clear input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = () => {
    if (attachments.some(a => a.state === 'uploading')) {
      toast.error('Please wait for uploads to finish.');
      return;
    }
    onSubmit(attachments.filter(a => a.state === 'done').map(a => ({
      name: a.name,
      url: a.url,
      sizeBytes: a.sizeBytes,
      mimetype: a.type
    })));
    setAttachments([]);
  };

  return (
    <div className="flex flex-col border-t px-4 py-3 gap-2">
      {attachments.length > 0 && (
        <AttachmentGroup>
          {attachments.map(att => (
            <Attachment key={att.id} state={att.state}>
              <AttachmentMedia variant={att.type.startsWith('image/') ? 'image' : 'icon'}>
                {att.type.startsWith('image/') ? <img src={att.url || URL.createObjectURL(new Blob())} alt="" /> : <FileTextIcon />}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{att.name}</AttachmentTitle>
                <AttachmentDescription>{Math.round(att.sizeBytes / 1024)} KB</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Remove" onClick={() => removeAttachment(att.id)}>
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
      <div className="flex items-end gap-2">
        <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
        <Button variant="ghost" size="icon-sm" className="mb-1" onClick={() => fileInputRef.current?.click()} aria-label="Attach file">
          <PaperclipIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
        <Textarea
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="max-h-40 min-h-10 resize-none"
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button className="mb-1" onClick={handleSubmit} disabled={disabled || (!value.trim() && attachments.length === 0)} aria-label="Send message">
          {disabled ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <SendIcon className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
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

          <Bubble
            variant={getBubbleVariant(isMine, message.authorId)}
            className={cn(reactions.length > 0 && 'mb-4', 'mt-1')}
          >
            {message.bodyText && (
              <BubbleContent className="whitespace-pre-wrap">
                {message.bodyText}
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
              <BubbleReactions align="start" side="bottom" className={cn("gap-0 p-0.5 bg-background border shadow-sm ring-background")}>
                {reactions.map(([emoji, info]) => (
                  <Tooltip key={emoji}>
                  <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onReact(emoji)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-muted',
                      info.mine
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {emoji} {info.count}
                  </button>
                  </TooltipTrigger>
                  <TooltipContent>{info.who.join(', ')}</TooltipContent>
                  </Tooltip>
                ))}
              </BubbleReactions>
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
