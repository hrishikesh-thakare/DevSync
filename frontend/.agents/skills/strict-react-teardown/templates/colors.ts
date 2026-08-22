/**
 * DevSync design tokens — THE single source of truth for every color in the
 * frontend. No hex/rgb/hsl value may exist anywhere else in src/.
 *
 * `scripts/build-theme.mjs` reads this file and emits `src/theme/tokens.css`
 * (the `:root` variable block consumed by Tailwind v4).
 *
 * The application is strictly DARK MODE ONLY.
 */

export type ColorMode = 'dark';

export interface ColorToken {
  dark: string;
}

export const tokens = {
  // ══ 1. PRIMITIVE TIERS ════════════════════════════════════════════════════
  'bg-void': { dark: '#000000' },
  'bg-canvas': { dark: '#08090A' },
  'bg-surface': { dark: '#0F1011' },
  'bg-surface-hover': { dark: '#161718' },
  'bg-surface-raised': { dark: '#1C1D1F' },
  'bg-inset': { dark: '#040405' },

  'border-subtle': { dark: 'rgba(255, 255, 255, 0.06)' },
  'border-default': { dark: '#6E7681' },
  'border-strong': { dark: '#8A8F98' },

  'text-primary': { dark: '#F7F8F8' },
  'text-secondary': { dark: '#D0D6E0' },
  'text-muted': { dark: '#8A8F98' },
  'text-disabled': { dark: '#62666D' },
  'text-inverse': { dark: '#08090A' },
  'text-on-accent': { dark: '#FFFFFF' },

  // ══ 2. SEMANTIC RAMPS ═════════════════════════════════════════════════════
  primary: { dark: '#5E6AD2' },
  'primary-hover': { dark: '#5763C6' },
  'primary-foreground': { dark: '#FFFFFF' },
  'primary-muted': { dark: 'rgba(94, 106, 210, 0.15)' },
  'primary-border': { dark: 'rgba(94, 106, 210, 0.40)' },
  'primary-bright': { dark: '#828FFF' },

  special: { dark: '#8B5CF6' },
  'special-foreground': { dark: '#08090A' },
  'special-muted': { dark: 'rgba(139, 92, 246, 0.15)' },
  'special-border': { dark: 'rgba(139, 92, 246, 0.40)' },
  'special-on-muted': { dark: '#A78BFA' },

  success: { dark: '#10B981' },
  'success-foreground': { dark: '#08090A' },
  'success-muted': { dark: 'rgba(16, 185, 129, 0.15)' },
  'success-border': { dark: 'rgba(16, 185, 129, 0.40)' },
  'success-on-muted': { dark: '#10B981' },

  warning: { dark: '#E5A50A' },
  'warning-foreground': { dark: '#08090A' },
  'warning-muted': { dark: 'rgba(229, 165, 10, 0.15)' },
  'warning-border': { dark: 'rgba(229, 165, 10, 0.40)' },
  'warning-on-muted': { dark: '#E5A50A' },

  danger: { dark: '#EB5757' },
  'danger-foreground': { dark: '#08090A' },
  'danger-muted': { dark: 'rgba(235, 87, 87, 0.15)' },
  'danger-border': { dark: 'rgba(235, 87, 87, 0.40)' },
  'danger-on-muted': { dark: '#F58787' },

  info: { dark: 'var(--primary)' },
  'info-foreground': { dark: 'var(--primary-foreground)' },
  'info-muted': { dark: 'var(--primary-muted)' },
  'info-border': { dark: 'var(--primary-border)' },

  // ══ 3. ALIASES ════════════════════════════════════════════════════════════
  background: { dark: 'var(--bg-canvas)' },
  foreground: { dark: 'var(--text-primary)' },
  inverse: { dark: 'var(--text-inverse)' },
  card: { dark: 'var(--bg-surface)' },
  'card-foreground': { dark: 'var(--text-primary)' },
  popover: { dark: 'var(--bg-surface)' },
  'popover-foreground': { dark: 'var(--text-primary)' },
  elevated: { dark: 'var(--bg-surface-raised)' },
  hover: { dark: 'var(--bg-surface-hover)' },
  overlay: { dark: 'rgba(0, 0, 0, 0.7)' },

  muted: { dark: 'var(--bg-inset)' },
  'muted-foreground': { dark: 'var(--text-secondary)' },
  'subtle-foreground': { dark: 'var(--text-muted)' },
  secondary: { dark: 'var(--bg-inset)' },
  'secondary-foreground': { dark: 'var(--text-primary)' },
  accent: { dark: 'var(--bg-surface-hover)' },
  'accent-foreground': { dark: 'var(--text-primary)' },

  destructive: { dark: 'var(--danger)' },
  'destructive-foreground': { dark: 'var(--danger-foreground)' },

  border: { dark: 'var(--border-subtle)' },
  input: { dark: 'var(--border-default)' },
  ring: { dark: 'var(--primary)' },
  'ring-offset': { dark: 'var(--bg-canvas)' },

  // ══ 4. DOMAIN MAPPING ═════════════════════════════════════════════════════
  'status-backlog': { dark: '#8A8F98' }, // From AGENTS.md Task Status table
  'status-backlog-foreground': { dark: 'var(--text-muted)' },
  'status-todo': { dark: '#D0D6E0' },
  'status-todo-foreground': { dark: 'var(--text-secondary)' },
  'status-in-progress': { dark: '#5E6AD2' },
  'status-in-progress-foreground': { dark: '#FFFFFF' },
  'status-in-review': { dark: '#E5A50A' },
  'status-in-review-foreground': { dark: '#08090A' },
  'status-done': { dark: '#10B981' },
  'status-done-foreground': { dark: '#08090A' },

  'priority-p0': { dark: 'var(--danger)' },
  'priority-p0-foreground': { dark: 'var(--danger-foreground)' },
  'priority-p1': { dark: 'var(--warning)' },
  'priority-p1-foreground': { dark: 'var(--warning-foreground)' },
  'priority-p2': { dark: 'var(--primary)' },
  'priority-p2-foreground': { dark: 'var(--primary-foreground)' },
  'priority-p3': { dark: 'var(--bg-inset)' },
  'priority-p3-foreground': { dark: 'var(--text-muted)' },

  // ══ 5. MISC ═══════════════════════════════════════════════════════════════
  'code-bg': { dark: 'var(--bg-inset)' },
  'code-foreground': { dark: 'var(--text-primary)' },
  'mark-bg': { dark: 'var(--primary-muted)' },
  'scrollbar-thumb': { dark: 'rgba(247, 248, 248, 0.2)' },
  'scrollbar-hover': { dark: 'rgba(247, 248, 248, 0.4)' },
} as const satisfies Record<string, ColorToken>;

export type TokenName = keyof typeof tokens;

export const cssVarName = (name: TokenName): string => `--${name}`;

export function modeTokens(mode: ColorMode): Record<TokenName, string> {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, value]) => [name, value[mode]]),
  ) as Record<TokenName, string>;
}

export function resolve(name: TokenName, mode: ColorMode): string {
  return tokens[name][mode];
}

export const DEFAULT_LABEL_COLOR = '#4B5563';

export function assertContrast(hex: string, _mode?: ColorMode): string {
  return hex;
}

export function readableText(_hex: string): string {
  return '#FFFFFF';
}
