import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initialsOf } from '@/lib/initials';
import { cn } from '@/lib/utils';
import type { Presence } from '@/types/api';

/**
 * Presence colours.
 *
 * Reuses the status domain tokens rather than inventing a parallel palette —
 * they are the categorical ramp already used by the boards, and the rose
 * `--chart-*` scale cannot separate categories (see index.css:99).
 */
const PRESENCE_STYLE: Record<Presence, { dot: string; label: string }> = {
  online: { dot: 'bg-status-done', label: 'Online' },
  away: { dot: 'bg-status-in-review', label: 'Away' },
  offline: { dot: 'bg-muted-foreground', label: 'Offline' },
};

export interface MemberLike {
  userId?: string | null;
  fullName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  presence?: Presence | null;
  statusText?: string | null;
  statusEmoji?: string | null;
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

  const detail = [
    style?.label,
    member.statusText ? `${member.statusEmoji ?? ''} ${member.statusText}`.trim() : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A span keeps the trigger focusable without turning the avatar into a
            button on surfaces where the row itself is already the click target. */}
        <span className="inline-flex">{avatar}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{name}</p>
        {detail ? <p className="text-xs opacity-80">{detail}</p> : null}
      </TooltipContent>
    </Tooltip>
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
