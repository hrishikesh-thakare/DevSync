/**
 * DevSync design tokens — THE single source of truth for every color in the
 * frontend. No hex/rgb/hsl value may exist anywhere else in src/.
 *
 * `scripts/build-theme.mjs` reads this file, verifies the §3 contrast contract,
 * and emits `src/theme/tokens.css` (the `:root` block consumed by Tailwind v4).
 *
 * The application is strictly DARK MODE ONLY. There is no mode axis: a token is
 * a string, not a `{ light, dark }` pair. See AGENTS.md §1.
 */

export const tokens = {
  // ══ 1. PRIMITIVE TIERS ════════════════════════════════════════════════════
  'bg-void': '#000000',
  'bg-canvas': '#08090A',
  'bg-surface': '#0F1011',
  'bg-surface-hover': '#161718',
  'bg-surface-raised': '#1C1D1F',
  'bg-inset': '#040405',

  'border-subtle': 'rgba(255, 255, 255, 0.06)',
  'border-default': '#6E7681',
  'border-strong': '#8A8F98',

  'text-primary': '#F7F8F8',
  'text-secondary': '#D0D6E0',
  'text-muted': '#8A8F98',
  'text-disabled': '#62666D',
  'text-inverse': '#08090A',
  'text-on-accent': '#FFFFFF',

  // ══ 2. SEMANTIC RAMPS ═════════════════════════════════════════════════════
  primary: '#5E6AD2',
  'primary-hover': '#5763C6',
  'primary-foreground': '#FFFFFF',
  'primary-muted': 'rgba(94, 106, 210, 0.15)',
  'primary-border': 'rgba(94, 106, 210, 0.40)',
  'primary-bright': '#828FFF',
  'primary-on-muted': '#828FFF',

  special: '#8B5CF6',
  'special-foreground': '#08090A',
  'special-muted': 'rgba(139, 92, 246, 0.15)',
  'special-border': 'rgba(139, 92, 246, 0.40)',
  'special-on-muted': '#A78BFA',

  success: '#10B981',
  'success-foreground': '#08090A',
  'success-muted': 'rgba(16, 185, 129, 0.15)',
  'success-border': 'rgba(16, 185, 129, 0.40)',
  'success-on-muted': '#10B981',

  warning: '#E5A50A',
  'warning-foreground': '#08090A',
  'warning-muted': 'rgba(229, 165, 10, 0.15)',
  'warning-border': 'rgba(229, 165, 10, 0.40)',
  'warning-on-muted': '#E5A50A',

  danger: '#EB5757',
  'danger-foreground': '#08090A',
  'danger-muted': 'rgba(235, 87, 87, 0.15)',
  'danger-border': 'rgba(235, 87, 87, 0.40)',
  'danger-muted-hover': 'rgba(235, 87, 87, 0.25)',
  'danger-on-muted': '#F58787',

  info: 'var(--primary)',
  'info-foreground': 'var(--primary-foreground)',
  'info-muted': 'var(--primary-muted)',
  'info-border': 'var(--primary-border)',
  'info-on-muted': 'var(--primary-bright)',

  // ══ 3. ALIASES ════════════════════════════════════════════════════════════
  background: 'var(--bg-canvas)',
  foreground: 'var(--text-primary)',
  inverse: 'var(--text-inverse)',
  card: 'var(--bg-surface)',
  'card-foreground': 'var(--text-primary)',
  // §8 puts dropdowns, popovers, tooltips and dialogs on the RAISED tier — it is
  // the highest elevation, and is what separates an overlay from the card below.
  popover: 'var(--bg-surface-raised)',
  'popover-foreground': 'var(--text-primary)',
  elevated: 'var(--bg-surface-raised)',
  hover: 'var(--bg-surface-hover)',
  overlay: 'rgba(0, 0, 0, 0.70)',

  muted: 'var(--bg-inset)',
  'muted-foreground': 'var(--text-secondary)',
  'subtle-foreground': 'var(--text-muted)',
  secondary: 'var(--bg-inset)',
  'secondary-foreground': 'var(--text-primary)',
  accent: 'var(--bg-surface-hover)',
  'accent-foreground': 'var(--text-primary)',
  // The nearly-invisible wash §8 specifies as an input's ground.
  'input-bg': 'rgba(255, 255, 255, 0.02)',

  destructive: 'var(--danger)',
  'destructive-foreground': 'var(--danger-foreground)',
  'destructive-on-muted': 'var(--danger-on-muted)',
  'destructive-muted': 'var(--danger-muted)',
  'destructive-muted-hover': 'var(--danger-muted-hover)',

  border: 'var(--border-subtle)',
  input: 'var(--border-default)',
  ring: 'var(--primary)',
  'ring-offset': 'var(--bg-canvas)',

  // ══ 4. DOMAIN MAPPING ═════════════════════════════════════════════════════
  // Status chips: `-bg` is the chip ground, `-foreground` its text.
  // §8 Status Chips — backlog/todo are neutral grounds with grey text, not fills.
  'status-backlog': '#8A8F98',
  'status-backlog-bg': 'var(--bg-surface-hover)',
  'status-backlog-foreground': 'var(--text-muted)',
  'status-todo': '#D0D6E0',
  'status-todo-bg': 'var(--bg-surface-hover)',
  'status-todo-foreground': 'var(--text-secondary)',
  'status-in-progress': '#5E6AD2',
  'status-in-progress-bg': 'var(--primary)',
  'status-in-progress-foreground': 'var(--text-on-accent)',
  'status-in-review': '#E5A50A',
  'status-in-review-bg': 'var(--warning)',
  'status-in-review-foreground': 'var(--text-inverse)',
  'status-done': '#10B981',
  'status-done-bg': 'var(--success)',
  'status-done-foreground': 'var(--text-inverse)',

  // Priority badges: 15% tints with the ramp's on-muted text (§8 Priority Badges).
  'priority-p0': 'var(--danger-muted)',
  'priority-p0-foreground': 'var(--danger-on-muted)',
  'priority-p1': 'var(--warning-muted)',
  'priority-p1-foreground': 'var(--warning-on-muted)',
  'priority-p2': 'var(--primary-muted)',
  'priority-p2-foreground': 'var(--primary-bright)',
  'priority-p3': 'var(--bg-surface-hover)',
  'priority-p3-foreground': 'var(--text-muted)',

  // ══ 5. MISC ═══════════════════════════════════════════════════════════════
  'code-bg': 'var(--bg-inset)',
  'code-foreground': 'var(--text-primary)',
  'mark-bg': 'rgba(94, 106, 210, 0.28)',
  'scrollbar-thumb': 'rgba(247, 248, 248, 0.36)',
  'scrollbar-hover': 'rgba(247, 248, 248, 0.55)',
} as const satisfies Record<string, string>;

export type TokenName = keyof typeof tokens;

export const cssVarName = (name: TokenName): string => `--${name}`;

export function resolve(name: TokenName): string {
  return tokens[name];
}

/* ════════════════════════════════════════════════════════════════════════════
   Contrast math (WCAG 2.1 relative luminance / contrast ratio).

   Used at runtime by the two label-color guards below, and at build time by
   scripts/build-theme.mjs to enforce the §3 contrast contract. Alpha tokens are
   composited over their backdrop before measurement — comparing raw values
   would silently skip every rgba() token, which is where the borders, tints and
   focus ring live.
   ════════════════════════════════════════════════════════════════════════════ */

export interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()`. Null if unparseable. */
export function parseColor(value: string): Rgb | null {
  const input = value.trim();

  const hex = input.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  const fn = input.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
      a: parts.length > 3 && !Number.isNaN(parts[3]) ? parts[3] : 1,
    };
  }

  return null;
}

const toHex = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

export function rgbToHex(c: Rgb): string {
  return ('#' + toHex(c.r) + toHex(c.g) + toHex(c.b)).toUpperCase();
}

/** Composite a possibly-translucent color over an opaque backdrop. */
export function composite(fg: Rgb, bg: Rgb): Rgb {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(c: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

/** WCAG 2.1 contrast ratio between two opaque colors. Range 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = la > lb ? la : lb;
  const lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/** Contrast between two color strings, compositing both over `over`. */
export function ratio(fg: string, bg: string, over: string = tokens['bg-canvas']): number {
  const base = parseColor(over);
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b || !base) return 0;
  const solidBg = composite(b, base);
  return contrastRatio(composite(f, solidBg), solidBg);
}

/* ════════════════════════════════════════════════════════════════════════════
   Label-color guards (AGENTS.md §2 "two deliberate exceptions", §10 "Don't
   render a DB-supplied label colour raw").

   A label color arrives from the database as an arbitrary user-chosen hex. Two
   things have to be true before it can be painted:

     1. The chip must be distinguishable from the surface behind it. A chip is a
        non-text graphic, so WCAG 1.4.11 asks 3:1 against `--bg-surface`.
     2. Some foreground must clear 4.5:1 on it, so the label text is legible.

   `assertContrast` lifts the color until (1) holds — on a near-black surface
   lightening is the only direction that gains contrast — and `readableText`
   answers (2) by picking the better of the two text tokens, which is §3's
   "dark text on filled swatches, light text on tints" rule applied per-swatch.
   ════════════════════════════════════════════════════════════════════════════ */

const CHIP_SURFACE = tokens['bg-surface'];
const MIN_GRAPHIC_CONTRAST = 3;

/** Neutral fallback for a label with no stored color — `--text-muted`, in palette. */
export const DEFAULT_LABEL_COLOR = '#8A8F98';

/**
 * Clamp a DB-supplied color until it reads as a chip on `--bg-surface`.
 * Always returns an opaque `#RRGGBB`.
 */
export function assertContrast(hex: string): string {
  const parsed = parseColor(hex);
  const surface = parseColor(CHIP_SURFACE);
  if (!parsed || !surface) return DEFAULT_LABEL_COLOR;

  const flat = composite(parsed, surface);
  if (contrastRatio(flat, surface) >= MIN_GRAPHIC_CONTRAST) return rgbToHex(flat);

  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const lifted: Rgb = {
      r: flat.r + (255 - flat.r) * t,
      g: flat.g + (255 - flat.g) * t,
      b: flat.b + (255 - flat.b) * t,
      a: 1,
    };
    if (contrastRatio(lifted, surface) >= MIN_GRAPHIC_CONTRAST) return rgbToHex(lifted);
  }

  return DEFAULT_LABEL_COLOR;
}

/**
 * Pick the text token that clears 4.5:1 on `hex` — `--text-inverse` for light
 * swatches, `--text-primary` for dark ones. Never unconditional white.
 */
export function readableText(hex: string): string {
  const parsed = parseColor(hex);
  if (!parsed) return tokens['text-primary'];

  const dark = parseColor(tokens['text-inverse']);
  const light = parseColor(tokens['text-primary']);
  if (!dark || !light) return tokens['text-primary'];

  const swatch: Rgb = { r: parsed.r, g: parsed.g, b: parsed.b, a: 1 };
  return contrastRatio(dark, swatch) >= contrastRatio(light, swatch)
    ? tokens['text-inverse']
    : tokens['text-primary'];
}
