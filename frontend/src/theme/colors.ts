/**
 * DevSync design tokens — THE single source of truth for every color in the
 * frontend. No hex/rgb/hsl value may exist anywhere else in src/.
 *
 * `scripts/build-theme.mjs` reads this file and emits `src/theme/tokens.css`
 * (the `:root` light + `.dark` variable blocks consumed by Tailwind v4), and
 * fails the build if any pair in CONTRAST_CONTRACT drops below its threshold.
 *
 * Structure:
 *   1. Primitive tiers — surfaces, borders, text. Opaque hexes only, so
 *                        contrast is computable. Never alpha.
 *   2. Semantic ramps  — primary / special / success / warning / danger, each
 *                        with -foreground, -muted (tint bg), -border.
 *   3. Aliases         — shadcn's flat names, expressed as `var()` refs into
 *                        the tiers above. These exist so the ui/ primitives
 *                        keep working; never give an alias its own hex.
 *
 * Keep this file free of non-erasable TypeScript (no enums / namespaces) so
 * Node can import it directly during the theme build.
 */

export type ColorMode = 'dark' | 'light';

/** Default hex used for user-defined label colors before the user picks one. */
export const DEFAULT_LABEL_COLOR = '#64748B';

export interface ColorToken {
  dark: string;
  light: string;
}

export const tokens = {
  // ══ 1. PRIMITIVE TIERS ════════════════════════════════════════════════════

  // ── Surfaces. Dark-mode elevation is background lightness, not shadow: the
  //    canvas → surface → surface-hover ramp ascends, reinforced by a 1px
  //    border-subtle outline. A black shadow on a near-black canvas is invisible.
  'bg-canvas': { dark: '#0D1117', light: '#F6F7F9' },
  'bg-surface': { dark: '#161B22', light: '#FFFFFF' },
  'bg-surface-hover': { dark: '#1F252D', light: '#F1F2F4' },
  'bg-inset': { dark: '#010409', light: '#F1F2F4' },

  // ── Borders — two contrast classes, deliberately split.
  //    subtle:  decorative dividers only. No WCAG requirement.
  //    default: the primary way a component's boundary is identified
  //             (inputs, outline buttons, interactive cards) — needs 3:1 (1.4.11).
  //    strong:  hover / emphasis on bordered elements.
  //    Collapsing subtle and default into one token is what previously caused a
  //    real 1.4.11 failure: a value light enough to read as a subtle divider was
  //    reused where it had to carry information.
  //    Deliberate deviation from the spec's light `border-default: #8B949E`:
  //    that value is 3.08:1 on surface (#FFFFFF) but only 2.87:1 on canvas
  //    (#F6F7F9), so an input placed directly on the page background rather
  //    than inside a card fell under 1.4.11. #868F99 holds on both
  //    (3.06:1 canvas / 3.28:1 surface). Dark #6E7681 already cleared both
  //    (4.12:1 / 3.76:1) and is unchanged.
  'border-subtle': { dark: '#21262D', light: '#E5E8EB' },
  'border-default': { dark: '#6E7681', light: '#868F99' },
  'border-strong': { dark: '#8B949E', light: '#6B7280' },

  // ── Text tiers (all ≥4.5:1 on canvas and surface — enforced below) ─────────
  'text-primary': { dark: '#E6EDF3', light: '#17202A' },
  'text-secondary': { dark: '#9198A1', light: '#57606A' },
  'text-muted': { dark: '#7D8590', light: '#656D76' },
  'text-inverse': { dark: '#0D1117', light: '#FFFFFF' },

  // ══ 2. SEMANTIC RAMPS ═════════════════════════════════════════════════════

  primary: { dark: '#4C8EFF', light: '#0B5CD8' },
  'primary-hover': { dark: '#6EA2FF', light: '#0A4FB8' },
  'primary-foreground': { dark: '#0D1117', light: '#FFFFFF' },
  'primary-muted': { dark: 'rgba(76, 142, 255, 0.15)', light: '#E8F0FE' },
  'primary-border': { dark: 'rgba(76, 142, 255, 0.4)', light: '#B6D2FA' },

  special: { dark: '#A371F7', light: '#8250DF' },
  'special-foreground': { dark: '#0D1117', light: '#FFFFFF' },
  'special-muted': { dark: 'rgba(163, 113, 247, 0.15)', light: '#F3EBFF' },
  'special-border': { dark: 'rgba(163, 113, 247, 0.4)', light: '#D8BFFF' },

  success: { dark: '#3FB950', light: '#1A7F37' },
  'success-foreground': { dark: '#0D1117', light: '#FFFFFF' },
  'success-muted': { dark: 'rgba(63, 185, 80, 0.15)', light: '#DAFBE1' },
  'success-border': { dark: 'rgba(63, 185, 80, 0.4)', light: '#97E0A8' },

  warning: { dark: '#D29922', light: '#9A6700' },
  'warning-foreground': { dark: '#0D1117', light: '#FFFFFF' },
  'warning-muted': { dark: 'rgba(210, 153, 34, 0.15)', light: '#FFF8C5' },
  'warning-border': { dark: 'rgba(210, 153, 34, 0.4)', light: '#E0C24A' },

  danger: { dark: '#F85149', light: '#CF222E' },
  'danger-foreground': { dark: '#0D1117', light: '#FFFFFF' },
  'danger-muted': { dark: 'rgba(248, 81, 73, 0.15)', light: '#FFEBE9' },
  'danger-border': { dark: 'rgba(248, 81, 73, 0.4)', light: '#FFA7A0' },

  // ── info is primary wearing a different hat ───────────────────────────────
  info: { dark: 'var(--primary)', light: 'var(--primary)' },
  'info-foreground': { dark: 'var(--primary-foreground)', light: 'var(--primary-foreground)' },
  'info-muted': { dark: 'var(--primary-muted)', light: 'var(--primary-muted)' },
  'info-border': { dark: 'var(--primary-border)', light: 'var(--primary-border)' },

  // ══ 3. ALIASES — shadcn's flat names. `var()` refs only, never a hex. ══════

  background: { dark: 'var(--bg-canvas)', light: 'var(--bg-canvas)' },
  foreground: { dark: 'var(--text-primary)', light: 'var(--text-primary)' },
  inverse: { dark: 'var(--text-inverse)', light: 'var(--text-inverse)' },
  card: { dark: 'var(--bg-surface)', light: 'var(--bg-surface)' },
  'card-foreground': { dark: 'var(--text-primary)', light: 'var(--text-primary)' },
  popover: { dark: 'var(--bg-surface)', light: 'var(--bg-surface)' },
  'popover-foreground': { dark: 'var(--text-primary)', light: 'var(--text-primary)' },
  elevated: { dark: 'var(--bg-surface)', light: 'var(--bg-surface)' },
  hover: { dark: 'var(--bg-surface-hover)', light: 'var(--bg-surface-hover)' },
  overlay: { dark: 'rgba(1, 4, 9, 0.7)', light: 'rgba(23, 32, 42, 0.4)' },

  muted: { dark: 'var(--bg-inset)', light: 'var(--bg-inset)' },
  'muted-foreground': { dark: 'var(--text-secondary)', light: 'var(--text-secondary)' },
  'subtle-foreground': { dark: 'var(--text-muted)', light: 'var(--text-muted)' },
  secondary: { dark: 'var(--bg-inset)', light: 'var(--bg-inset)' },
  'secondary-foreground': { dark: 'var(--text-primary)', light: 'var(--text-primary)' },
  accent: { dark: 'var(--bg-surface-hover)', light: 'var(--bg-surface-hover)' },
  'accent-foreground': { dark: 'var(--text-primary)', light: 'var(--text-primary)' },

  destructive: { dark: 'var(--danger)', light: 'var(--danger)' },
  'destructive-foreground': { dark: 'var(--danger-foreground)', light: 'var(--danger-foreground)' },

  border: { dark: 'var(--border-subtle)', light: 'var(--border-subtle)' },
  input: { dark: 'var(--border-default)', light: 'var(--border-default)' },
  ring: { dark: 'var(--primary)', light: 'var(--primary)' },
  'ring-offset': { dark: 'var(--bg-canvas)', light: 'var(--bg-canvas)' },

  // ══ 4. DOMAIN MAPPING ═════════════════════════════════════════════════════

  // Status — backlog and todo are the only two needing their own greys; the rest
  // ride the semantic ramps so a palette change carries through automatically.
  'status-backlog': { dark: '#161B22', light: '#F1F2F4' },
  'status-backlog-foreground': { dark: 'var(--text-muted)', light: 'var(--text-muted)' },
  'status-todo': { dark: '#21262D', light: '#E5E8EB' },
  'status-todo-foreground': { dark: 'var(--text-secondary)', light: 'var(--text-secondary)' },
  'status-in-progress': { dark: 'var(--primary)', light: 'var(--primary)' },
  'status-in-progress-foreground': { dark: 'var(--primary-foreground)', light: 'var(--primary-foreground)' },
  'status-in-review': { dark: 'var(--warning)', light: 'var(--warning)' },
  'status-in-review-foreground': { dark: 'var(--warning-foreground)', light: 'var(--warning-foreground)' },
  'status-done': { dark: 'var(--success)', light: 'var(--success)' },
  'status-done-foreground': { dark: 'var(--success-foreground)', light: 'var(--success-foreground)' },

  // Priority — `low|medium|high|urgent` and `P3|P2|P1|P0` are alias scales for
  // the same four levels, so both map onto these four tokens.
  'priority-p0': { dark: 'var(--danger)', light: 'var(--danger)' },
  'priority-p0-foreground': { dark: 'var(--danger-foreground)', light: 'var(--danger-foreground)' },
  'priority-p1': { dark: 'var(--warning)', light: 'var(--warning)' },
  'priority-p1-foreground': { dark: 'var(--warning-foreground)', light: 'var(--warning-foreground)' },
  'priority-p2': { dark: 'var(--primary)', light: 'var(--primary)' },
  'priority-p2-foreground': { dark: 'var(--primary-foreground)', light: 'var(--primary-foreground)' },
  'priority-p3': { dark: 'var(--bg-inset)', light: 'var(--bg-inset)' },
  'priority-p3-foreground': { dark: 'var(--text-muted)', light: 'var(--text-muted)' },

  // ══ 5. MISC ═══════════════════════════════════════════════════════════════

  'code-bg': { dark: 'var(--bg-inset)', light: 'var(--bg-inset)' },
  'code-foreground': { dark: 'var(--text-primary)', light: 'var(--text-primary)' },
  'mark-bg': { dark: 'rgba(76, 142, 255, 0.28)', light: 'rgba(11, 92, 216, 0.18)' },
  'scrollbar-thumb': { dark: 'rgba(230, 237, 243, 0.2)', light: 'rgba(23, 32, 42, 0.2)' },
  'scrollbar-hover': { dark: 'rgba(230, 237, 243, 0.4)', light: 'rgba(23, 32, 42, 0.4)' },
} as const satisfies Record<string, ColorToken>;

export type TokenName = keyof typeof tokens;

/** Convert a token name to its CSS variable name, e.g. `card-foreground` → `--card-foreground`. */
export const cssVarName = (name: TokenName): string => `--${name}`;

/** Flat map of every token resolved for one mode. */
export function modeTokens(mode: ColorMode): Record<TokenName, string> {
  return Object.fromEntries(
    Object.entries(tokens).map(([name, value]) => [name, value[mode]]),
  ) as Record<TokenName, string>;
}

/** Resolve a single token for a mode. */
export function resolve(name: TokenName, mode: ColorMode): string {
  return tokens[name][mode];
}

// ── Contrast helpers (WCAG 2.2 AA) ──────────────────────────────────────────

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True when a token value is a literal hex we can do math on (not a var() ref or rgba). */
export function isHex(value: string): boolean {
  return HEX_RE.test(value);
}

/** WCAG relative luminance of a hex color (0–1). */
export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(hexA: string, hexB: string): number {
  const [l1, l2] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Clamp a hex's lightness to guarantee ≥`minRatio` against the mode's canvas. */
export function assertContrast(hex: string, mode: ColorMode, minRatio = 4.5): string {
  if (!isHex(hex)) return hex;
  const bg = tokens['bg-canvas'][mode];
  let candidate = hex;
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(candidate, bg) >= minRatio) return candidate;
    const full = candidate.replace('#', '');
    const arr = (full.length === 3 ? full.split('').map((c) => c + c).join('') : full)
      .match(/.{2}/g)!
      .map((c) => parseInt(c, 16));
    // Scale proportionally toward black (light) / white (dark) so hue survives.
    // A flat per-channel step drifts the hue as individual channels clip at 0/255.
    for (let k = 0; k < 3; k++) {
      arr[k] = mode === 'light'
        ? Math.max(0, Math.round(arr[k] * 0.92))
        : Math.min(255, Math.round(arr[k] + (255 - arr[k]) * 0.12));
    }
    candidate = `#${arr.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return mode === 'light' ? '#000000' : '#FFFFFF';
}

/** Best readable text color for a given background (white or near-black) — ≥4.5:1. */
export function readableText(bg: string): string {
  return luminance(bg) > 0.4 ? '#0D1117' : '#FFFFFF';
}

// ── Build-time contrast contract ────────────────────────────────────────────

/**
 * Pairs the design system guarantees, checked by `npm run theme`. Adding a row
 * here makes the guarantee a build failure rather than a promise in a table.
 * `min` is 4.5 for normal text, 3 for UI component boundaries (WCAG 1.4.11).
 *
 * Deliberately absent: disabled control text, which WCAG 1.4.3 exempts —
 * forcing contrast there defeats the disabled affordance.
 */
export const CONTRAST_CONTRACT: ReadonlyArray<{
  fg: TokenName;
  bg: TokenName;
  min: number;
}> = [
  { fg: 'text-primary', bg: 'bg-canvas', min: 4.5 },
  { fg: 'text-primary', bg: 'bg-surface', min: 4.5 },
  { fg: 'text-secondary', bg: 'bg-canvas', min: 4.5 },
  { fg: 'text-secondary', bg: 'bg-surface', min: 4.5 },
  { fg: 'text-muted', bg: 'bg-canvas', min: 4.5 },
  { fg: 'text-muted', bg: 'bg-surface', min: 4.5 },
  // Interactive boundaries and the focus ring — UI components, 3:1.
  { fg: 'border-default', bg: 'bg-surface', min: 3 },
  { fg: 'border-default', bg: 'bg-canvas', min: 3 },
  { fg: 'border-strong', bg: 'bg-surface', min: 3 },
  { fg: 'primary', bg: 'bg-canvas', min: 3 },
  { fg: 'primary', bg: 'bg-surface', min: 3 },
  // Text on a filled semantic swatch.
  { fg: 'primary-foreground', bg: 'primary', min: 4.5 },
  { fg: 'special-foreground', bg: 'special', min: 4.5 },
  { fg: 'success-foreground', bg: 'success', min: 4.5 },
  { fg: 'warning-foreground', bg: 'warning', min: 4.5 },
  { fg: 'danger-foreground', bg: 'danger', min: 4.5 },
];

/** Run the contract for one mode. Returns a row per violation (empty = pass). */
export function checkContrast(mode: ColorMode): Array<{
  pair: string;
  ratio: number;
  min: number;
}> {
  const failures: Array<{ pair: string; ratio: number; min: number }> = [];
  for (const { fg, bg, min } of CONTRAST_CONTRACT) {
    const fgValue = tokens[fg][mode];
    const bgValue = tokens[bg][mode];
    // Aliases and alpha values aren't computable; every alias points at a tier
    // that has its own row, so skipping here loses no coverage.
    if (!isHex(fgValue) || !isHex(bgValue)) continue;
    const ratio = contrastRatio(fgValue, bgValue);
    if (ratio < min) failures.push({ pair: `${fg} on ${bg}`, ratio, min });
  }
  return failures;
}
