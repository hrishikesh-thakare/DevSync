import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';
import { PRESENCE_STYLE } from '@/lib/presence';
import type { Presence } from '@/types/api';

export interface MemberLike {
  userId?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  presence?: Presence | null;
  statusText?: string | null;
}

const nameOf = (m: MemberLike) => m.displayName || m.fullName || 'Unknown';

/**
 * An avatar that actually shows whether the person is around.
 *
 * Presence has been fully plumbed for a while — it is user-editable in Account
 * settings, broadcast over `user_presence_updated`, and merged into the
 * workspace store by `updateMemberPresence` — but nothing ever rendered it, so
 * setting your status had no visible effect for anyone. This is the last mile.
 *
 * Pass `presence={null}` (or omit it) on surfaces where the roster does not
 * carry presence — `listWorkspaceMembers` omits it, unlike `getWorkspace` — and
 * the dot is left off rather than guessing "offline".
 */
export function MemberAvatar({
  member,
  size = 'default',
  showPresence = true,
  className,
}: {
  member: MemberLike;
  size?: 'sm' | 'default' | 'lg';
  showPresence?: boolean;
  className?: string;
}) {
  const name = nameOf(member);
  const presence = member.presence ?? null;
  const style = presence ? PRESENCE_STYLE[presence] : null;

  const avatar = (
    <Avatar size={size} className={className}>
      {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
      <AvatarFallback className={size === 'sm' ? 'text-[9px]' : undefined}>
        {initialsOf(name)}
      </AvatarFallback>
      {showPresence && style ? (
        <AvatarBadge className={cn('border-0', style.dot)} aria-hidden="true" />
      ) : null}
    </Avatar>
  );

  const statusLine = member.statusText
    ? member.statusText
    : null;

  return (
    // `openDelay`/`closeDelay` pull Radix's defaults (700ms/300ms) down close
    // to a tooltip's own feel — this replaced a `Tooltip` on every avatar in
    // the app, including fast-moving surfaces like board cards, so it has to
    // stay quick rather than linger the way a card meant for one profile popup
    // normally would.
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {/* A span keeps the trigger focusable without turning the avatar into a
            button on surfaces where the row itself is already the click target. */}
        <span className="inline-flex">{avatar}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-64">
        <div className="flex gap-3">
          <Avatar size="lg" className="shrink-0">
            {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initialsOf(name)}</AvatarFallback>
            {style ? <AvatarBadge className={cn('border-0', style.dot)} aria-hidden="true" /> : null}
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium text-foreground">{name}</p>
            {member.email ? (
              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
            ) : null}
            {style ? <p className="text-xs text-muted-foreground">{style.label}</p> : null}
            {statusLine ? <p className="text-sm text-foreground">{statusLine}</p> : null}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Overlapping stack with a "+N" counter, for showing who is on a project,
 * channel or task at a glance. `AvatarGroup` and `AvatarGroupCount` shipped in
 * the component library but had no callers until now.
 */
export function MemberAvatarStack({
  members,
  max = 4,
  size = 'sm',
  className,
}: {
  members: MemberLike[];
  max?: number;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}) {
  if (members.length === 0) return null;

  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <AvatarGroup className={className} data-size={size}>
      {shown.map((m, i) => (
        <MemberAvatar key={m.userId ?? i} member={m} size={size} />
      ))}
      {overflow > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <AvatarGroupCount className={cn(size === 'sm' && 'size-6 text-xs')}>
              +{overflow}
            </AvatarGroupCount>
          </TooltipTrigger>
          <TooltipContent>
            {members.slice(max).map((m) => nameOf(m)).join(', ')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </AvatarGroup>
  );
}
