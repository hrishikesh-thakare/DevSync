# DevSync Design System

> A dark-only, Linear-inspired design system for a developer collaboration platform.
> Built on Tailwind CSS v4, hand-built UI primitives, and Radix-free custom components.
> Font stack: Inter Variable (UI) + JetBrains Mono (code).

**This is the final, corrected version.** It merges the original spec with two fixes verified
against the actual repo (§2's tech stack was describing packages that aren't installed) and
folds in the previously-separate addendum as real sections (§14–20) instead of a linked file.
Light mode is not part of this system — confirmed final, not a placeholder decision.

---

## 1. Visual Theme & Atmosphere

DevSync treats darkness as its native medium. The canvas at `rgb(8, 9, 10)` is near-black with a faint warmth — not pure #000000, not GitHub's blue-tinted #0D1117, but a neutral charcoal that lets content float. Above it, a five-level surface ladder rises in single-digit RGB increments, creating depth through barely perceptible brightness shifts rather than shadows.

**This app is dark-only. There is no light mode. Do not add a light mode toggle, light theme tokens, or conditional light/dark styling.**

The sole chromatic accent is a muted indigo (`#5E6AD2`) — Linear's signature lavender-blue. It marks interactive elements (links, primary CTAs, focus rings) and nothing else. Functional colors for status and priority exist but are used sparingly: small chips, dot indicators, and badges — never as section backgrounds or large fills.

Typography uses Inter Variable at two non-standard weights: **510** (between regular and medium) for emphasis and **590** (between medium and semibold) for strong emphasis. These in-between weights create hierarchy that feels calibrated, not stepped. OpenType features `cv01` and `ss03` are enabled on all UI text for geometric precision.

The overall feel is: **dense, technical, quietly luxurious** — software that looks like it was built by engineers who care about craft.

---

## 2. Tech Stack Context — corrected against the actual repo

The original version of this table listed shadcn/ui, Radix, class-variance-authority, cmdk,
and Sonner. **None of those five packages exist in `frontend/package.json`.** This is the
corrected table — verified by reading the real dependency list, not assumed:

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React + Vite | SPA, client-side routing via react-router-dom |
| **Styling** | Tailwind CSS v4 | Use utility classes, not raw CSS-in-JS |
| **Components** | Hand-built, in `src/components/ui/` | **No shadcn/ui, no Radix primitives installed.** These are DevSync's own components — build interaction/accessibility behavior (focus trap, keyboard nav, portal rendering) explicitly rather than assuming a primitives library provides it |
| **Variants** | Conditional classes via `cn()` (clsx + tailwind-merge) | **No class-variance-authority.** Express variants as a plain object/switch mapping prop class string, merged with `cn()` |
| **Tokens** | CSS custom properties | Defined in `src/theme/tokens.css` (create this if it doesn't exist yet), sourced from `src/theme/colors.ts` |
| **Fonts** | Inter Variable + JetBrains Mono | Loaded via Google Fonts in `index.html` |
| **Icons** | Lucide React | Consistent icon set across all components — see §16 |
| **Animation** | Framer Motion (landing page only) | In-app transitions use CSS transitions only |
| **State** | Zustand | Stores in `src/store/` |
| **Drag & drop** | dnd-kit | Kanban board, backlog LexoRank reordering |
| **Rich text** | Lexical | Chat composer and task description |
| **Command palette** | Hand-built | **No cmdk dependency.** Custom implementation — apply the visual spec in §8 directly to your own component, don't wrap a library that isn't installed |
| **Toasts** | Hand-built `ToastProvider` / `useToast` | **No Sonner.** Already implemented at `src/components/ui/ToastProvider.tsx` and in active use — apply §8's Toasts spec to this component, don't introduce Sonner alongside it |
| **Real-time** | socket.io-client | Chat, presence, notifications |
| **Charts** | Recharts | Installed but unused today — see §8 before adding one |

**Rules for AI agents:**

- **Use Tailwind utility classes.** Never write inline styles or `<style>` blocks, except for
  the two runtime-value cases named below.
- **Reach colours through the alias utilities, not the tier names.** `bg-background`,
  `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary` are the
  vocabulary at call sites. The tier tokens in §3 (`--bg-canvas`, `--text-primary`, ) are
  what those aliases point at — they are source-of-truth names, not class names. One name per
  role: do not introduce a second spelling for the same colour.
- **Never hardcode a hex, `rgb()`, or `hsl()` value in `.ts`/`.tsx`.** Every colour lives in
  `src/theme/colors.ts`. This is a lint error, not a convention.
- **Two deliberate exceptions**, both runtime values that cannot be tokens:
  1. User-defined label colours from the database — must pass through `assertContrast()` and
     `readableText()` from `@/theme/colors` before rendering, never applied raw.
  2. A computed dimension, such as a progress bar's percentage width.
- **Use existing components from `src/components/ui/`** before creating new ones — check what's
  there first; do not assume a shadcn-style generator can add to this folder, everything here
  is hand-authored.
- **Use `cn()` from `src/lib/utils`** for conditional class merging.

---

## 3. Color Palette

### Surface Hierarchy

The entire dark surface system lives in a compressed luminance range. Depth is communicated through near-imperceptible brightness shifts — like rooms lit by distant starlight.

| Token | Value | Hex | Role |
|---|---|---|---|
| `--bg-void` | `rgb(0, 0, 0)` | `#000000` | Absolute black — overlay scrims, shadow bases |
| `--bg-canvas` | `rgb(8, 9, 10)` | `#08090A` | Page background — the void from which content emerges |
| `--bg-surface` | `rgb(15, 16, 17)` | `#0F1011` | Cards, panels, sidebar — primary elevated surface |
| `--bg-surface-hover` | `rgb(22, 23, 24)` | `#161718` | Hovered cards, active list rows, chat input area |
| `--bg-surface-raised` | `rgb(28, 29, 31)` | `#1C1D1F` | Dropdowns, popovers, tooltips — highest elevation |
| `--bg-inset` | `rgb(4, 4, 5)` | `#040405` | Inset panels, code block backgrounds, recessed areas |

### Border System

Two contrast classes, deliberately split. `--border-subtle` is decoration and may be
white-alpha. `--border-default` and `--border-strong` are the only thing identifying an
interactive control's boundary, so WCAG 1.4.11 requires >=3:1 — which white-alpha cannot
reach at any subtle opacity. They are opaque hex.

| Token | Value | Hex | Role | Contrast |
|---|---|---|---|---|
| `--border-subtle` | `rgba(255, 255, 255, 0.06)` | — | Decorative dividers — card edges, section separators | none required |
| `--border-default` | `rgb(110, 118, 129)` | `#6E7681` | Interactive boundaries — inputs, outlined buttons | 4.34:1 canvas / 4.15:1 surface / 3.67:1 raised |
| `--border-strong` | `rgb(138, 143, 152)` | `#8A8F98` | Hover emphasis, focused borders | 6.13:1 canvas / 5.86:1 surface / 5.19:1 raised |

**Do not express `--border-default` or `--border-strong` as white-alpha.** At `0.10` the
composite is 1.29:1 on surface and at `0.16` it is 1.57:1 — both far under 3:1. Reaching 3:1
with white-alpha needs roughly `0.33`, which is no longer a subtle border. Collapsing
`--border-subtle` into `--border-default` is the same failure by another route: a value light
enough to read as a decorative divider cannot also carry information.

### Text Hierarchy

| Token | Value | Hex | Role |
|---|---|---|---|
| `--text-primary` | `rgb(247, 248, 248)` | `#F7F8F8` | Headlines, primary content — near-white, not pure white |
| `--text-secondary` | `rgb(208, 214, 224)` | `#D0D6E0` | Descriptions, subtitles — cool blue-grey that recedes gracefully |
| `--text-muted` | `rgb(138, 143, 152)` | `#8A8F98` | Metadata, timestamps, auxiliary — deliberate dimness |
| `--text-disabled` | `rgb(98, 102, 109)` | `#62666D` | **Disabled controls only** — 3.45:1, below 4.5:1 |
| `--text-inverse` | `rgb(8, 9, 10)` | `#08090A` | Dark text on light/accent backgrounds |
| `--text-on-accent` | `rgb(255, 255, 255)` | `#FFFFFF` | Pure white — text on `--primary` / `--info` only (4.70:1) |

`--text-disabled` is scoped to disabled controls because WCAG 1.4.3 exempts them; at 3.45:1
it is not legal for content. **Footnotes, eyebrow labels, and quaternary text use
`--text-muted`** (`#8A8F98`, 6.13:1 on canvas / 5.86:1 on surface).

### Brand & Accent

| Token | Value | Hex | Role |
|---|---|---|---|
| `--primary` | `rgb(94, 106, 210)` | `#5E6AD2` | Links, primary CTA, focus rings — muted indigo accent |
| `--primary-hover` | `rgb(87, 99, 198)` | `#5763C6` | Hovered **filled** primary buttons — indigo darkens |
| `--primary-bright` | `rgb(130, 143, 255)` | `#828FFF` | Indigo **text** on dark surfaces and on indigo tints |
| `--primary-muted` | `rgba(94, 106, 210, 0.15)` | — | Tinted backgrounds for primary selections, badges |
| `--primary-border` | `rgba(94, 106, 210, 0.40)` | — | Border for primary-tinted containers |

The filled-button hover **darkens** rather than lightens. A lighter indigo cannot carry
`--text-on-accent`: white on `#828FFF` is 2.87:1. `#5763C6` holds white at 5.24:1 and still
clears 3:1 against every surface. The lighter `#828FFF` keeps its own job as indigo *text* —
it is 6.95:1 on canvas and 5.76:1 on the indigo tint, where the base `#5E6AD2` is only 3.74:1.

### Semantic Colors

Each semantic ramp has five tokens: base, foreground (text on the filled base), muted (tinted
background), on-muted (text on that tint), and border.

| Ramp | Base | Hex | Foreground | On-muted text | Muted | Border | Usage |
|---|---|---|---|---|---|---|---|
| **Success** | `rgb(16, 185, 129)` | `#10B981` | `#08090A` (7.86:1) | `#10B981` (6.08:1) | `rgba(16, 185, 129, 0.15)` | `rgba(16, 185, 129, 0.40)` | Done status, success alerts |
| **Warning** | `rgb(229, 165, 10)` | `#E5A50A` | `#08090A` (9.22:1) | `#E5A50A` (6.91:1) | `rgba(229, 165, 10, 0.15)` | `rgba(229, 165, 10, 0.40)` | In Review, P1, caution alerts |
| **Danger** | `rgb(235, 87, 87)` | `#EB5757` | `#08090A` (5.73:1) | `#F58787` (6.69:1) | `rgba(235, 87, 87, 0.15)` | `rgba(235, 87, 87, 0.40)` | P0 Urgent, destructive actions, error states |
| **Info** | `rgb(94, 106, 210)` | `#5E6AD2` | `#FFFFFF` (4.70:1) | `#828FFF` `--primary-bright` (5.76:1) | `rgba(94, 106, 210, 0.15)` | `rgba(94, 106, 210, 0.40)` | Informational alerts (aliases primary) |
| **Special** | `rgb(139, 92, 246)` | `#8B5CF6` | `#08090A` (4.71:1) | `#A78BFA` (6.06:1) | `rgba(139, 92, 246, 0.15)` | `rgba(139, 92, 246, 0.40)` | Feature labels, special badges |

**Dark text on filled swatches, light text on tints.** Only `--primary` / `--info` is dark
enough to carry `#FFFFFF` at 4.5:1 — white on `#EB5757` is 3.48:1 and white on `#8B5CF6` is
4.23:1, both failing. Conversely a base colour is often too dark to sit on *its own* 15%
tint: `#5E6AD2` on the indigo tint is 3.74:1 and `#8B5CF6` on the violet tint is 3.90:1, so
those two ramps use a lightened on-muted value. Ratios above are measured against
`--bg-surface`; each is equal or better on `--bg-canvas`.

### Domain Colors — Task Status

| Status | Color | Token | Chip Style |
|---|---|---|---|
| **Backlog** | `rgb(138, 143, 152)` | `--status-backlog` | Muted gray text on `--bg-surface` with subtle border |
| **Todo** | `rgb(208, 214, 224)` | `--status-todo` | Light gray text on `--bg-surface-hover` with default border |
| **In Progress** | `rgb(94, 106, 210)` | `--status-in-progress` | White text on indigo base |
| **In Review** | `rgb(229, 165, 10)` | `--status-in-review` | Dark text on amber base |
| **Done** | `rgb(16, 185, 129)` | `--status-done` | Dark text on green base |

### Domain Colors — Priority

| Priority | Color | Token | Usage |
|---|---|---|---|
| **P0 — Urgent** | `rgb(235, 87, 87)` | `--priority-p0` | Danger red — immediate attention |
| **P1 — High** | `rgb(229, 165, 10)` | `--priority-p1` | Warning amber |
| **P2 — Medium** | `rgb(94, 106, 210)` | `--priority-p2` | Primary indigo |
| **P3 — Low** | `rgb(138, 143, 152)` | `--priority-p3` | Muted gray |

### Domain Colors — Sprint, CI, Membership, Presence

Every domain colour **aliases a semantic ramp from the tables above**. No domain introduces a
new hue, so a palette change carries through automatically and nothing needs re-measuring.
Tinted chips take the ramp's on-muted text; filled chips take its foreground.

| Domain state | Background | Text | Ramp |
|---|---|---|---|
| **Sprint** future | `--bg-surface-hover` | `--text-muted` | neutral |
| **Sprint** active | `--primary` | `--text-on-accent` | primary |
| **Sprint** closed | `--bg-inset` | `--text-muted` | neutral |
| **CI** queued | `--bg-surface-hover` | `--text-muted` | neutral |
| **CI** in_progress | `--warning-muted` | `#E5A50A` | warning |
| **CI** success | `--success-muted` | `#10B981` | success |
| **CI** failure | `--danger-muted` | `#F58787` | danger |
| **CI** cancelled / skipped | `--bg-inset` | `--text-muted` | neutral |
| **PR / issue** open | `--success-muted` | `#10B981` | success |
| **PR** merged | `--special-muted` | `#A78BFA` | special |
| **PR / issue** closed | `--danger-muted` | `#F58787` | danger |
| **Member** active | `--success-muted` | `#10B981` | success |
| **Member** invited | `--warning-muted` | `#E5A50A` | warning |
| **Member** deactivated | `--bg-inset` | `--text-muted` | neutral |

Presence is a dot, not a chip — 8px, `--radius-full`, rendered on the avatar's bottom-right
with a 2px ring in the surface colour behind it so it reads as separate from the photo.
**Verify the exact accepted values against your validation layer before shipping** — the
`users.presence` column is an unconstrained `varchar`, so the real enum lives in a Zod schema
or controller, not the table definition.

| Presence | Color |
|---|---|
| online | `--success` |
| away | `--warning` |
| offline | `--text-muted`, hollow (1px `--border-strong`, transparent fill) |

A presence dot is a non-text graphic and needs 3:1 against the surface behind it. That is why
offline uses `--text-muted` (5.86:1) rather than `--text-disabled` (3.45:1).

### Notification Type Mapping

Verified against the real backend enum (`notifications.type`) rather than assumed:

| Type | Icon (Lucide) | Ramp | Copy pattern |
|---|---|---|---|
| `task_assigned` | `UserPlus` | primary | "{actor} assigned you {task}" |
| `task_unassigned` | `UserMinus` | muted | "{actor} unassigned you from {task}" |
| `task_mentioned` | `AtSign` | primary | "{actor} mentioned you in {task}" |
| `task_commented` | `MessageSquare` | primary | "{actor} commented on {task}" |
| `task_status_changed` | `ArrowRightCircle` | muted | "{actor} moved {task} to {status}" |
| `channel_mentioned` | `AtSign` | primary | "{actor} mentioned you in #{channel}" |
| `dm_received` | `MessageCircle` | primary | "{actor} sent you a message" |
| `sprint_started` | `PlayCircle` | special | "{sprint} started" |
| `sprint_closed` | `CheckCircle` | special | "{sprint} closed — {velocity} pts completed" |
| `commit_linked` / `commit_unlinked` | `GitCommit` | muted | "Commit linked/unlinked — {task}" |
| `workspace_invited` | `Mail` | success | "{actor} invited you to {workspace}" |
| `project_member_added` | `UserPlus` | success | "{actor} added you to {project}" |

Icon sits in the 28px circle specified under Notification Rows in §8, tinted with the ramp's
`-muted` background and the ramp's on-muted text color for the icon itself.

### Utility Tokens

Not decoration — each covers a job the ramps don't.

| Token | Value | Role |
|---|---|---|
| `--overlay` | `rgba(0, 0, 0, 0.70)` | Dialog and drawer scrim |
| `--code-bg` | `var(--bg-inset)` | Inline code, code blocks, log viewers |
| `--code-foreground` | `var(--text-primary)` | Code text |
| `--mark-bg` | `rgba(94, 106, 210, 0.28)` | Search-result `<mark>` highlight |
| `--scrollbar-thumb` | `rgba(247, 248, 248, 0.36)` | Custom scrollbar — 6px wide, 3px radius (3.11:1 minimum) |
| `--scrollbar-hover` | `rgba(247, 248, 248, 0.55)` | Scrollbar hover |

`<mark>` uses `--text-primary` on `--mark-bg`. Do not bold it — §4 forbids 600.

### Color Philosophy

- **Achromatic by default.** The interface is black, near-black, and near-white. Color is earned, not given.
- **Indigo is the only accent.** `#5E6AD2` marks interactive elements. No second accent color.
- **Status colors appear only in chips, dots, and small badges.** Never as section backgrounds or large fills.
- **All white text uses `#F7F8F8`, not `#FFFFFF`.** Pure white is reserved for text on `--primary`.
- **Decorative borders use white-alpha; informational borders use opaque hex.** Alpha adapts to any dark surface without manual tuning, but it cannot reach 3:1 while still reading as subtle — so it is confined to `--border-subtle`.
- **Depth is decorative; boundaries are informational.** The canvassurface ladder is 1.05:1 and is not required to clear any threshold — it reads as depth, not as a border. What separates one surface from another is the hairline ring, and that ring has to be visible.

### Contrast Contract

These pairs are guarantees, not aspirations, and **should be enforced at build time by a
script (e.g. `frontend/scripts/build-theme.mjs`) — this does not exist yet, build it before
relying on this section as a real guardrail rather than a design intent.** `min` is 4.5 for
normal text and 3 for UI component boundaries and focus indicators (WCAG 1.4.11 / 2.4.11).

| Foreground | Background | Min |
|---|---|---|
| `--text-primary`, `--text-secondary`, `--text-muted` | `--bg-canvas`, `--bg-surface`, `--bg-surface-raised` | 4.5 |
| `--border-default`, `--border-strong` | `--bg-canvas`, `--bg-surface`, `--bg-surface-raised` | 3 |
| `--primary` (focus ring) | `--bg-canvas`, `--bg-surface`, `--bg-surface-raised` | 3 |
| each ramp's foreground | its filled base | 4.5 |
| each ramp's on-muted text | its 15% tint composited over canvas **and** surface | 4.5 |

`--text-disabled` is deliberately absent: WCAG 1.4.3 exempts disabled controls, and forcing
contrast there defeats the disabled affordance.

**A checker that compares raw token values will silently skip every `rgba()` token**, which
is precisely where the borders, tints, and focus ring live. The contract is only meaningful
if alpha values are composited over each background before measuring. Skipping them is not a pass — it is an unchecked pair.

---

## 4. Typography

### Font Loading

```html
<!-- index.html -->
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Critical:** Load Inter as a **variable font** (weight range 100-900) to unlock the 510 and 590 weights that define this design system.

### Font Stacks

| Context | Stack | CSS Variable |
|---|---|---|
| UI / Prose | `'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif` | `--font-sans` |
| Code | `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` | `--font-mono` |

### OpenType Features

Apply `font-feature-settings: "cv01", "ss03"` to all UI text globally. In Inter:
- `cv01` — alternate glyph forms for improved geometric consistency
- `ss03` — character adjustments for better UI readability

**Do NOT apply these to code/mono text or form inputs** — standard character recognition matters more than aesthetics in those contexts.

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Role |
|---|---|---|---|---|---|
| `--text-display` | 2.5rem (40px) | 590 | 1.15 | -1.0px | Page titles, hero headlines |
| `--text-h1` | 1.5rem (24px) | 590 | 1.25 | -0.6px | Section headers |
| `--text-h2` | 1.25rem (20px) | 590 | 1.33 | -0.24px | Subsection headers |
| `--text-h3` | 1rem (16px) | 590 | 1.5 | normal | Card titles, dialog titles |
| `--text-body` | 0.9375rem (15px) | 400 | 1.6 | -0.165px | Default reading text |
| `--text-ui` | 0.875rem (14px) | 510 | 1.5 | normal | Navigation links, interactive labels |
| `--text-caption` | 0.75rem (12px) | 400 | 1.4 | normal | Timestamps, metadata, footnotes |
| `--text-micro` | 0.6875rem (11px) | 510 | 1.3 | 0.2px | Eyebrow labels, tiny badges |
| `--text-button` | 0.8125rem (13px) | 510 | 1.2 | normal | Button labels |
| `--text-code` | 0.8125rem (13px) | 400 | 1.5 | normal | Inline code, code blocks (JetBrains Mono) |

### Weight System — The 510/590 Rule

| Weight | Name | Usage |
|---|---|---|
| **400** | Regular | Body text, paragraphs, form inputs, descriptions |
| **510** | Emphasis | Navigation links, button labels, UI interactive text, metadata emphasis |
| **590** | Strong | Headings (h1-h3), card titles, page titles |

**Never use 600, 700, or bold.** The heaviest weight in this system is 590. Emphasis comes from weight 510 and from size/spacing — not from bold. If you find yourself reaching for `font-bold` or `font-semibold`, use `font-[510]` or `font-[590]` instead.

### Negative Tracking Rule

Letter-spacing tightens as size increases:

| Size Range | Letter Spacing | Why |
|---|---|---|
| <= 14px | `normal` or `0` | Small text needs standard spacing for readability |
| 15-16px | `-0.165px` | Subtle tightening at body size |
| 20px | `-0.24px` | Noticeable density at subheading size |
| 24px | `-0.6px` | Pronounced tightening |
| 40px+ | `-1.0px` | Aggressive tracking for display presence |

These values are tuned for Latin script. If the product ever goes multilingual, revisit this
table first — negative tracking misbehaves with CJK and Arabic.

---

## 5. Elevation & Depth

### Surface Ladder (Primary Depth System)

Depth is communicated through the surface brightness ramp, not through shadows. Each step up the ladder represents a higher conceptual elevation.

| Level | Surface | Usage |
|---|---|---|
| -1 (inset) | `--bg-inset` (`#040405`) | Code blocks, recessed panels |
| 0 (canvas) | `--bg-canvas` (`#08090A`) | Page background |
| 1 (surface) | `--bg-surface` (`#0F1011`) | Cards, sidebar, panels |
| 2 (hover) | `--bg-surface-hover` (`#161718`) | Hovered rows, active states, chat input |
| 3 (raised) | `--bg-surface-raised` (`#1C1D1F`) | Dropdowns, popovers, tooltips, modals |

### Shadow System

Shadows are supplementary to the surface ladder, not the primary depth mechanism. Every drop
shadow is pure black — no colored tints.

**The one exception is `--shadow-ring`, which must be light, not black.** A black ring on a
near-black canvas is invisible: `rgba(0,0,0,0.33)` over `#08090A` composites to `#050506`,
which is 1.06:1 against a `#0F1011` card — the card would have no perceptible edge. The ring
is what separates a raised surface from the one beneath it, so it uses `--border-subtle`.

| Token | Value | Usage |
|---|---|---|
| `--shadow-ring` | `0 0 0 1px var(--border-subtle)` | Ring shadow as border — contained elements (use instead of CSS border for cards/rows) |
| `--shadow-hairline` | `rgba(0, 0, 0, 0.03) 0px 1.2px 0px 0px` | Barely-there bottom edge definition |
| `--shadow-elevated` | `rgba(0,0,0,0) 0 8px 2px, rgba(0,0,0,0.01) 0 5px 2px, rgba(0,0,0,0.04) 0 3px 2px, rgba(0,0,0,0.07) 0 1px 1px, rgba(0,0,0,0.08) 0 0 1px` | Five-layer composite for dropdowns, modals |
| `--shadow-press` | `rgba(0, 0, 0, 0.4) 0px 1px 0px 0px` | Pressed/inset button state |

### Focus Ring

```css
/* 2px outline in primary at full opacity */
outline: 2px solid var(--primary);
outline-offset: 2px;
```

Use this pattern for all keyboard-focusable elements. **Full opacity, not 50%.** WCAG 2.4.11
requires the focus indicator to reach 3:1 against the adjacent background; `#5E6AD2` at full
opacity measures 4.24:1 on canvas, 4.05:1 on surface, 3.59:1 on raised. At 50% opacity it
composites to 1.87:1 and fails.

`rgba(94, 106, 210, 0.5)` may be used as a supplementary outer glow *in addition to* the
full-opacity outline, never as the sole indicator.

### Z-Index Tiers

Named tiers, in ascending order. **A bare `z-index: 999` anywhere is a bug** — it wins against
everything until the next thing picks 1000.

| Token | Value | Usage |
|---|---|---|
| `--z-base` | 0 | Default flow |
| `--z-sticky` | 10 | Sticky headers, sticky table rows |
| `--z-dropdown` | 20 | Dropdowns, popovers, mention popover |
| `--z-overlay` | 30 | Dialog scrim, drag overlay |
| `--z-modal` | 40 | Dialog and drawer panels |
| `--z-toast` | 9999 | Toasts (`ToastProvider`) — strictly reserved to ensure alerts always sit above modals, overlays, and tooltips |
| `--z-tooltip` | 60 | Tooltips — always on top |

---

## 6. Border Radius Scale

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | 2px | Inline code, micro elements |
| `--radius-sm` | 4px | Small chips, status dots with rounded corners |
| `--radius-md` | 6px | Buttons, inputs, form elements — **default interactive radius** |
| `--radius-lg` | 8px | Cards, dialog panels, sidebar sections |
| `--radius-full` | 9999px | Avatars, status dots, pill badges |

**Do not use border-radius above 8px on rectangular elements.** No 12px, no 16px, no "friendly" card radii. The aesthetic is engineered precision, not soft friendliness.

---

## 7. Spacing System

Base unit: **4px**. All spacing uses multiples.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Minimal gaps, icon-to-text |
| `--space-2` | 8px | Tight gaps, chip padding |
| `--space-3` | 12px | Input padding, compact card padding |
| `--space-4` | 16px | Default component padding |
| `--space-6` | 24px | Card padding, section gaps |
| `--space-8` | 32px | Section spacing |
| `--space-12` | 48px | Large section spacing |
| `--space-24` | 96px | Page section separation |

---

## 8. Component Patterns

### Buttons

Ghost-first philosophy — default buttons are transparent. Color is earned.

| Variant | Background | Text | Border | Radius |
|---|---|---|---|---|
| **Ghost** (default) | `transparent` | `--text-muted` | none | 6px |
| **Ghost hover** | `--bg-surface-hover` | `--text-primary` | none | 6px |
| **Primary** | `--primary` | `--text-on-accent` | none | 6px |
| **Primary hover** | `--primary-hover` | `--text-on-accent` | none | 6px |
| **Secondary/Outline** | `--bg-surface` | `--text-primary` | `--border-default` | 6px |
| **Destructive** | `rgba(235, 87, 87, 0.15)` | `#F58787` (6.69:1) | none | 6px |
| **Destructive hover** | `rgba(235, 87, 87, 0.25)` | `#F58787` (5.75:1) | none | 6px |

Button text: `--text-button` (13px, weight 510). Height: 32px (default), 28px (small), 36px (large). Implement variants as a plain object map (`{ ghost: '...', primary: '...' }`) selected by prop and merged with `cn()` — no CVA.

### Cards

| Property | Value |
|---|---|
| Background | `--bg-surface` |
| Border | `--shadow-ring` (ring shadow, not CSS border) |
| Radius | 8px (`--radius-lg`) |
| Padding | 24px (`--space-6`) |
| Title | 16px, weight 590, `--text-primary` |
| Description | 14px, weight 400, `--text-secondary` |

On hover, shift background to `--bg-surface-hover`. No scale transforms, no opacity changes — color only.

### Inputs & Forms

| Property | Value |
|---|---|
| Background | `rgba(255, 255, 255, 0.02)` (nearly invisible) |
| Border | `--border-default` (`#6E7681`, 4.15:1 on surface) |
| Text | `--text-secondary` |
| Placeholder | `--text-muted` |
| Font | 14px, weight 400 |
| Radius | 6px |
| Height | 36px (default), 32px (compact) |
| Focus | 2px outline `var(--primary)` at full opacity, offset 2px; keep or remove the border |

### Sidebar Navigation

| Property | Value |
|---|---|
| Background | `--bg-surface` |
| Width | 240px (collapsible; icon-rail or overlay drawer below 1024px — see §17) |
| Nav items text | 14px, weight 510, `--text-muted` |
| Active item | Background `--primary-muted`, text `--text-primary` |
| Hover item | Background `--bg-surface-hover`, text `--text-primary` |
| Section headers | 11px, weight 510, `--text-muted`, letter-spacing +0.2px (eyebrow style) |
| Dividers | 1px `--border-subtle` |
| Structure, top to bottom | Workspace switcher -> primary nav (Home, Search) -> Projects (collapsible group) -> Channels (collapsible group) -> bottom-pinned user avatar + presence dot + name |

Semantic element: `<nav>`, not a styled `<div>` — see §19.

### Top Bar / Header

| Property | Value |
|---|---|
| Background | `--bg-surface` |
| Height | 56px |
| Bottom border | `--border-subtle` |
| Search input | Ghost style, `--text-muted` placeholder |
| User avatar | 28px circle, `--radius-full` |

Semantic element: `<header>`.

### Status Chips

Small, compact indicators — never large fills.

| Status | Background | Text | Border | Size |
|---|---|---|---|---|
| Backlog | `--bg-surface-hover` | `--text-muted` | `--border-subtle` | 12px caption, pill radius, padding 2px 8px |
| Todo | `--bg-surface-hover` | `--text-secondary` | `--border-default` | Same |
| In Progress | `--primary` | `--text-on-accent` | none | Same |
| In Review | `#E5A50A` | `--text-inverse` | none | Same |
| Done | `#10B981` | `--text-inverse` | none | Same |

### Priority Badges

Same chip dimensions as status. Icon + label or icon-only at small sizes.

| Priority | Background | Text |
|---|---|---|
| P0 — Urgent | `rgba(235, 87, 87, 0.15)` | `#F58787` (6.69:1) |
| P1 — High | `rgba(229, 165, 10, 0.15)` | `#E5A50A` (6.91:1) |
| P2 — Medium | `rgba(94, 106, 210, 0.15)` | `#828FFF` `--primary-bright` (5.76:1) |
| P3 — Low | `--bg-surface-hover` | `--text-muted` (5.86:1) |

P0 and P2 use their lightened on-muted values rather than the base colour: `#EB5757` on the
red tint is 4.64:1 and drops to 3.99:1 on the 0.25 hover tint, and `#5E6AD2` on the indigo
tint is only 3.74:1. This is the on-muted rule from §3 applied.

### Kanban Board

| Element | Spec |
|---|---|
| Column background | `--bg-canvas` (sits at page level) |
| Column header | 13px, weight 510, `--text-muted`, with task count badge |
| Column order | Fixed: Todo -> In Progress -> In Review -> Done. Users reorder cards, never columns |
| Task card | `--bg-surface`, `--shadow-ring`, 8px radius, 16px padding |
| Task card hover | `--bg-surface-hover` |
| Task card dragging | `--shadow-elevated`, slight opacity (0.8), z-index overlay |
| Drop target | `--primary-muted` background, `--primary-border` dashed border |
| Column gap | 12px between columns |
| Card gap | 8px between cards |
| Empty column | Empty state, compact (24px padding), "No tasks" + ghost "Add task" |
| Keyboard reordering | dnd-kit's keyboard sensor — drag-only reordering is not acceptable, see §19 |

### Chat / Messages

| Element | Spec |
|---|---|
| Message area background | `--bg-canvas` |
| Message bubble (own) | `--bg-surface` — no special "sent" color |
| Message bubble (other) | `--bg-surface` — same as own, differentiated by alignment/avatar |
| Message text | 15px, weight 400, `--text-primary` |
| Timestamp | 12px, weight 400, `--text-muted` |
| Message grouping | Consecutive messages from the same author within 5 minutes collapse — avatar/name shown once, later messages indent to align, timestamp shows on hover only |
| System messages | Centred, `--text-muted`, `--text-caption`, no avatar/bubble |
| Chat input area | `--bg-surface-hover` background, `--border-default` border |
| @mention chip | Background `rgba(94, 106, 210, 0.15)`, text `--primary-bright` `#828FFF` (5.76:1 — `#6D78D5` is 4.44:1 and fails) |
| Code in messages | Background `rgba(255, 255, 255, 0.05)`, border `--border-subtle`, 2px radius, JetBrains Mono |
| Reactions | `--bg-surface-hover`, pill radius, 12px text |
| Thread reply | Opens as right-anchored Side Panel (384px), not inline expansion |
| Incoming messages | `aria-live="polite"` region — see §19 |

### Dialogs & Modals

| Property | Value |
|---|---|
| Overlay | `rgba(0, 0, 0, 0.70)` |
| Panel background | `--bg-surface-raised` |
| Panel radius | 8px |
| Panel width | 480px default, 640px for content-heavy dialogs |
| Panel shadow | `--shadow-elevated` |
| Title | 16px, weight 590, `--text-primary` |
| Enter animation | Scale from 0.96 to 1.0, opacity 0 to 1, duration 200ms, ease `cubic-bezier(0.4, 0, 0.2, 1)` |

Closing returns focus to the element that opened the dialog — see §19.

### Dropdowns & Popovers

| Property | Value |
|---|---|
| Background | `--bg-surface-raised` |
| Border | `--shadow-ring` |
| Shadow | `--shadow-elevated` |
| Radius | 8px |
| Item padding | 8px 12px |
| Item text | 14px, weight 400, `--text-secondary` |
| Item hover | Background `--bg-surface-hover`, text `--text-primary` |
| Item active | Background `--primary-muted`, text `--text-primary` |

### Tooltips

| Property | Value |
|---|---|
| Background | `--bg-surface-raised` |
| Text | `--text-secondary`, 12px, weight 400 |
| Border | `--shadow-ring` |
| Radius | 6px |
| Padding | 6px 10px |

Not a substitute for `aria-label` on icon-only buttons — see §19.

### Tables & Data Lists

| Element | Spec |
|---|---|
| Header row | `--text-muted`, 12px, weight 510, uppercase or eyebrow style |
| Body row | `--bg-canvas` base, `--bg-surface` on hover |
| Row border | `--border-subtle` bottom only |
| Cell text | 14px, weight 400, `--text-secondary` |
| Selected row | `--primary-muted` background |

Sortable headers get a 14px `ArrowUpDown` icon in `--text-muted`, becoming `--text-primary`
on the active sort column. The whole header cell is the click target, and it is a `<button>` —
not a `<th>` with an `onClick`.

### Tabs

Three tab idioms exist in the app. Use **one per context** and do not mix them on a screen.

| Idiom | When | Spec |
|---|---|---|
| **Underline** (default) | Section navigation inside a page — project Board/Backlog/Sprints | 14px, weight 510, `--text-muted`; active `--text-primary` + 2px `--primary` bottom border; 1px `--border-subtle` rail under the whole row |
| **Segmented** | Binary or short filters — All/Unread, Tasks/Messages | Container `--bg-surface`, 6px radius, 2px padding; item 13px weight 510 `--text-muted`; active `--bg-surface-raised` + `--text-primary` |
| **Count tabs** | Tabs carrying a quantity — PRs/Issues/CI/Commits | Underline idiom plus a count pill (see Count Badges) |

Active state must not be colour alone — the underline or the raised segment carries it too.

### Avatars

| Size | Dimension | Usage |
|---|---|---|
| `xs` | 20px | Table rows, dense lists |
| `sm` | 24px | Task cards, comment rows |
| `md` | 28px | Top bar, message author |
| `lg` | 40px | Profile headers |

Always `--radius-full`. Fallback is initials at weight 510 on `--bg-surface-raised` with
`--text-secondary` — **never a random colour per user**; §3's one-accent rule holds here.

**Avatar groups** overlap at -8px with a 2px ring in the surface colour behind them, max 3
visible, then a `+N` chip using the same fallback treatment. Do not render a group as a
decorative placeholder — if the members aren't loaded, render nothing.

### Progress

| Property | Value |
|---|---|
| Track | `--bg-inset`, 6px tall, `--radius-full` |
| Fill | `--primary`, `--radius-full` |
| Over-capacity fill | `--warning` |
| Label | 12px `--text-muted`, outside the bar — never inside it |
| Transition | `width` over `--duration-base` |

A progress bar is a graphic, so it needs `role="progressbar"` with `aria-valuenow` /
`aria-valuemin` / `aria-valuemax`, and the numeric value must also exist as text.

### Toasts

| Property | Value |
|---|---|
| Position | Bottom-right, 16px inset |
| Background | `--bg-surface-raised` |
| Border | `--shadow-ring` |
| Shadow | `--shadow-elevated` |
| Radius | 8px |
| Title | 14px weight 510 `--text-primary` |
| Body | 13px weight 400 `--text-secondary` |
| Status accent | 3px left bar in the ramp colour — success / warning / danger / info |
| Duration | 4s default, indefinite for errors |

Implemented via the existing `ToastProvider`/`useToast` — apply this spec to that component.
Toasts announce asynchronous results, so the live region is not optional: `role="status"` for
success and info, `role="alert"` for errors.

### Command Palette

| Property | Value |
|---|---|
| Overlay | `--overlay` |
| Panel | `--bg-surface-raised`, 8px radius, `--shadow-elevated`, 640px max width, top 20vh |
| Input | Ghost, 15px, no border, 1px `--border-subtle` bottom rule |
| Group heading | 11px weight 510 `--text-muted`, letter-spacing +0.2px |
| Item | 14px `--text-secondary`, 8px 12px padding, 6px radius |
| Item active | `--bg-surface-hover`, `--text-primary` |
| Shortcut chip | 11px `--font-mono`, `--bg-inset`, `--text-muted`, 4px radius, 2px 6px padding |
| Empty state | 14px `--text-muted`, centred, 32px vertical padding |

Hand-built component (no cmdk). Selection follows the keyboard, so the active item is styled
by `aria-selected`, not `:hover`.

### Form Controls

| Control | Spec |
|---|---|
| **Checkbox** | 16px, 4px radius, 1px `--border-default`; checked `--primary` fill + `--text-on-accent` check; indeterminate `--primary` fill + 2px dash |
| **Radio** | 16px, `--radius-full`, 1px `--border-default`; checked 6px `--primary` centre dot |
| **Switch** | 3218px track `--bg-inset`, 14px `--text-secondary` thumb; checked track `--primary`, thumb `--text-on-accent` |
| **Select** | Input styling from Inputs & Forms; 14px chevron in `--text-muted`; menu uses Dropdowns & Popovers |
| **Label** | 13px weight 510 `--text-secondary`, 6px below |
| **Help text** | 12px `--text-muted` |
| **Error text** | 12px `#F58787`, paired with `aria-invalid` and a 1px `--danger-border` on the field |
| **Validation** | Validate on `onBlur` for pristine fields, and `onChange` for fields that have already shown an error |

Every control needs a `<label>`. A placeholder is not a label — it disappears on input.

### Empty States

One canonical form. Do not invent per-screen variants.

| Element | Spec |
|---|---|
| Container | Centred, 48px vertical padding, no border unless it is a drop target |
| Icon | 32px Lucide, `--text-muted` |
| Heading | 15px weight 510 `--text-secondary`, 12px below the icon |
| Hint | 13px `--text-muted`, max 48ch, 4px below — describe the *next action*, not just the absent state (see §18) |
| Action | Optional single primary button, 16px below |
| Drop-target variant | 1px dashed `--border-default`, 8px radius |

### Error Boundary Fallback

| Element | Spec |
|---|---|
| Container | Centered, `--bg-canvas` |
| Icon | `OctagonAlert` (Lucide) icon in `--danger` |
| Heading | `--text-h3` ("Something went wrong") |
| Description | `--text-secondary` description of the error (or a generic message in prod) |
| Action | "Reload Page" primary button |

### Loading

Two languages, one rule: **skeletons for layout you can predict, spinners for actions you cannot.**

| Case | Treatment |
|---|---|
| List / table / card grid loading | Skeleton rows matching the real row height |
| Whole-page first load | Skeleton, not a centred spinner |
| Button submitting | 14px inline spinner replacing the icon; label stays |
| Background refresh | Nothing, or a 2px `--primary` top progress line |

Skeleton: `--bg-surface-hover`, 4px radius, `animate-pulse`. **Delay 200ms before showing
one** — a skeleton that flashes for 80ms is worse than no skeleton. Spinners keep animating
under `prefers-reduced-motion` at reduced speed; a frozen spinner reads as a hung UI.

### Pagination

| Element | Spec |
|---|---|
| Container | Right-aligned, 12px gap, 16px above |
| Position text | 13px `--text-muted` — "Page 2 of 7" |
| Prev / next | Ghost icon buttons, 28px, disabled at the ends |
| Disabled | 50% opacity, `pointer-events: none` |

### Filter Bars

| Element | Spec |
|---|---|
| Container | 8px gap, 12px below the page header |
| Filter toggle | Ghost button + 14px icon; a 6px `--primary` dot appears when any filter is active |
| Filter control | Compact select, 32px tall |
| Clear | Ghost button, 13px `--text-muted`, only rendered when something is active |

The active-filter dot matters: a filtered view that looks identical to an unfiltered one is
how people conclude their data is missing.

### Selection & Bulk Actions

| Element | Spec |
|---|---|
| Bar | `--bg-surface-raised`, `--shadow-ring`, 8px radius, 12px 16px padding, sticky above the list |
| Count | 13px weight 510 `--text-primary` — "3 selected" |
| Actions | Ghost buttons; destructive uses the Destructive variant |
| Dismiss | Ghost icon button, right-aligned |

The bar appears only with a selection, and animates in per §9 (opacity + 4px translateY).

### Notification Rows

| Element | Spec |
|---|---|
| Row | 12px 16px padding, `--border-subtle` bottom, `--bg-surface-hover` on hover |
| Unread marker | 2px `--primary` left bar, full row height |
| Icon | 28px circle, ramp-tinted per notification type — see the mapping table in §3 |
| Title | 14px, weight 510 unread / 400 read, `--text-primary` |
| Body | 13px `--text-muted`, one line, ellipsised |
| Timestamp | 12px `--text-muted`, right-aligned |
| Mark read | Ghost icon button, revealed on hover **and on focus** |

Unread is marked by the bar *and* the weight — never by colour alone. Incoming notifications
are a live region — see §19.

### Count Badges

| Variant | Spec |
|---|---|
| Neutral (tab counts) | `--bg-inset`, `--text-muted`, 11px, `--radius-full`, 1px 6px padding |
| Unread (sidebar, bell) | `--primary`, `--text-on-accent`, same dimensions |
| Overflow | Render `99+` above 99 — never let the pill grow |

### Side Panel / Drawer

Distinct from a dialog: it does not trap focus in a modal sense and the page stays usable.

| Property | Value |
|---|---|
| Width | 384px default, full height, right-anchored. **Task detail uses 480px** (needs more room than the default drawer) |
| Background | `--bg-surface` |
| Left border | 1px `--border-subtle` |
| Header | 56px, title 15px weight 510, close ghost icon button |
| Enter | translateX 100% -> 0, `--duration-slow`, `--ease-standard` |
| Below 1024px | Full width |

### Rich-Text Editor

| Element | Spec |
|---|---|
| Container | `--bg-surface-hover`, 1px `--border-default`, 6px radius |
| Container focus | Border becomes `--primary`; the focus outline goes on the container, not the contenteditable |
| Content | `--text-body` (15px/1.6), 12px padding, max-height 300px then scroll |
| Placeholder | `--text-muted`, absolutely positioned, `pointer-events: none` |
| Toolbar | 32px tall, `--border-subtle` top rule, 2px gap |
| Toolbar button | 28px ghost icon; active state `--bg-surface-raised` + `--text-primary` + `aria-pressed="true"` |
| Toolbar separator | 1px `--border-subtle`, 16px tall, 4px margin |
| Send | Primary button, 28px, or icon-only below 640px |
| Mention popover | Dropdown styling, caret-anchored, `--z-dropdown`, max 6 rows then scroll |
| Mention row | 28px avatar + 14px name + 12px `--text-muted` handle |

Built on Lexical. Editor content uses `--font-sans` with `cv01`/`ss03` **disabled** — it is
user prose being composed, and §4's rule about inputs applies.

### Code & Log Viewers

| Element | Spec |
|---|---|
| Inline code | `--code-bg`, `--code-foreground`, 2px radius, 0.125em 0.375em padding, `--text-code` |
| Code block | `--code-bg`, 1px `--border-subtle`, 6px radius, 12px padding, horizontal scroll |
| Log viewer | `--code-bg`, `--text-code`, 12px padding, `--text-secondary`, max-height 60vh |
| Log job header | 13px weight 510 `--text-primary`, sticky, `--bg-surface-raised` |

Never apply `cv01`/`ss03` here. Code blocks scroll horizontally inside their own container —
the page body must never scroll sideways.

### Danger Zone

| Property | Value |
|---|---|
| Panel | `--danger-muted` background, 1px `--danger-border`, 8px radius, 24px padding |
| Heading | 15px weight 590 `#F58787` |
| Description | 13px `--text-secondary` |
| Action | Destructive button, right-aligned |
| Type-to-confirm | Input where the user types the object's actual name (not a generic "DELETE"); the button stays disabled until it matches |

Destructive actions that cannot be undone require type-to-confirm, not just a dialog. Always
the last section on a settings page, with extra margin above to separate it from normal
settings.

### Attachments

| Element | Spec |
|---|---|
| Row | 8px 12px padding, `--bg-surface`, `--shadow-ring`, 6px radius |
| Type icon | 16px Lucide, `--text-muted`, chosen by MIME type |
| Name | 14px `--text-primary`, ellipsised in the middle, not the end |
| Meta | 12px `--text-muted` — size and uploader |
| Actions | Ghost icon buttons, revealed on hover and focus |
| Image preview | Max 320x240, 6px radius, 1px `--border-subtle` |
| Drop target | 1px dashed `--primary-border`, `--primary-muted` background |

### Charts

Recharts is installed but unused. If a chart is added:

- Grid lines `--border-subtle`; axis lines and ticks `--text-muted` at `--text-caption`.
- Single series uses `--primary`. Multi-series draws in order: `--primary`, `--success`,
  `--warning`, `--special`, `--danger` — these are already contrast-checked and are the only
  approved sequence. Do not introduce a categorical palette.
- Never encode meaning by colour alone: label the series directly or provide a legend plus a
  shape or dash pattern.
- Tooltip uses Tooltips above, not a Recharts default.

---

## 9. Motion & Transitions

### Timing

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | 100ms | Hover color changes, focus ring |
| `--duration-base` | 180ms | Most transitions — state changes, reveals |
| `--duration-slow` | 240ms | Modal enter/exit, panel slides |

### Easing

| Token | Value | Usage |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | All transitions — Material's standard easing |

### Rules

- **Hover/focus transitions**: color and background-color only. No scale, no translate, no opacity changes on interactive elements.
- **Modal/overlay enter**: scale from 0.96, opacity from 0, duration `--duration-slow`.
- **Dropdown enter**: opacity from 0, translateY from -4px, duration `--duration-base`.
- **Side panel enter**: translateX 100% to 0, duration `--duration-slow`.
- **Selection bar enter**: opacity from 0, translateY from 4px, duration `--duration-base`.
- **Drag and drop is the one place transforms are allowed.** A card being dragged may scale to
  1.02 and drop to 0.8 opacity, and lifts to `--shadow-elevated` at `--z-overlay`. The drop
  target gets `--primary-muted` with a dashed `--primary-border`. This is direct manipulation,
  not decoration — the rule above is about hover and focus.
- **No ambient animations.** No pulsing, floating, or continuously moving elements in the app UI. Loading spinners and skeleton pulses are exempt.
- **Respect `prefers-reduced-motion`**: collapse all animations to 1ms, but keep spinners and
  skeleton pulses running at reduced speed — a frozen spinner reads as a hung UI.

---

## 10. Do's and Don'ts

### Do

- **Use the 510/590 weight pair.** These in-between weights are the design's signature. `font-[510]` for emphasis, `font-[590]` for headings.
- **Build depth through surface color, not shadows.** The difference between `#08090A` and `#0F1011` IS the elevation.
- **Use white-alpha only for decorative dividers** (`--border-subtle`). Anything that identifies an interactive control's boundary uses the opaque `--border-default` / `--border-strong`.
- **Use ring shadows for contained elements** (`0 0 0 1px var(--border-subtle)`) instead of CSS `border`. The ring must be light — a black ring is invisible on this canvas.
- **Give every focus indicator a full-opacity outline.** 50% opacity fails 2.4.11.
- **Enable `cv01` and `ss03`** OpenType features on all UI text. Omit them on code and inputs.
- **Tighten letter-spacing as size increases.** `-0.24px` at 20px, `-0.6px` at 24px, `-1.0px` at 40px.
- **Keep status/priority colors in small chips only.** 12px text, pill radius, 2px 8px padding.
- **Use `--text-primary` (#F7F8F8) for important text**, not pure white.
- **State the next action in empty/error copy**, not just the absent state — see §18.

### Don't

- **Don't add a light mode.** This app is dark-only — confirmed, final.
- **Don't use `font-bold` or `font-semibold`.** The heaviest weight is 590. Use `font-[510]` or `font-[590]`.
- **Don't use border-radius above 8px** on rectangular UI elements. No 12px cards, no 16px panels.
- **Don't use colored shadows.** Every drop shadow is `rgba(0, 0, 0, ...)`. No tinted glows. (`--shadow-ring` is not a drop shadow — it is a hairline border and is light.)
- **Don't express `--border-default` or `--border-strong` as white-alpha.** They need >=3:1; alpha can't get there subtly.
- **Don't use `--text-disabled` for content.** It's 3.45:1 — disabled controls only. Footnotes and eyebrow labels use `--text-muted`.
- **Don't encode state by colour alone.** Unread gets a bar *and* a weight change; an active tab gets an underline; a chart series gets a direct label. Colour is the second signal, never the only one.
- **Don't render a DB-supplied label colour raw.** Pass it through `assertContrast()` / `readableText()` — an arbitrary user hex will otherwise land under 4.5:1.
- **Don't invent a new hue for a domain state.** Sprint, CI, PR, and membership states all alias an existing semantic ramp.
- **Don't use a bare `z-index` number.** Use the `--z-*` tiers.
- **Don't show a skeleton without a 200ms delay**, and don't replace a whole page with a centred spinner when the layout is predictable.
- **Don't put `#FFFFFF` on `--danger` or `--special`.** 3.48:1 and 4.23:1. Only `--primary` / `--info` carries white.
- **Don't put a base semantic color on its own 15% tint** without checking it. `--primary` and `--special` both fail; use their on-muted values.
- **Don't use gradients** for backgrounds, cards, or buttons. Flat surfaces only.
- **Don't use status colors as section backgrounds.** Red, green, amber are for small indicators only.
- **Don't use `#000000` true black as the canvas.** Use `#08090A` — the faint warmth matters.
- **Don't use `#FFFFFF` for body text.** Use `#F7F8F8`. Pure white is for text on colored backgrounds only.
- **Don't animate hover states with scale, translate, or opacity.** Color changes only.
- **Don't introduce a second accent color.** Indigo (`#5E6AD2`) is the only accent.
- **Don't reach for CVA, cmdk, Sonner, or Radix.** None are installed — use `cn()`, the hand-built command palette, `ToastProvider`, and your own component logic respectively.
- **Don't claim the contrast contract is enforced until `build-theme.mjs` actually exists and runs in CI.**

---

## 11. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | 640px | Single column, stacked layouts, hamburger nav |
| Tablet | 768px | Two-column layouts, sidebar collapses |
| Desktop | 1024px | Full sidebar + content, kanban multi-column |
| Wide | 1280px | Max content width, expanded panels |

### Rules

- Sidebar collapses to an icon rail or hamburger below 1024px.
- Kanban board scrolls horizontally below 768px.
- Card grids: 3-up to 2-up at 1024px to 1-up below 768px.
- Display text scales down: `--text-display` 40px to 28px on mobile.
- Inputs maintain 16px font size to prevent iOS auto-zoom.
- Touch targets: minimum 44px height on mobile.

---

## 12. Quick Reference

```
Canvas:            #08090A    rgb(8, 9, 10)
Surface:           #0F1011    rgb(15, 16, 17)
Surface Hover:     #161718    rgb(22, 23, 24)
Surface Raised:    #1C1D1F    rgb(28, 29, 31)

Text Primary:      #F7F8F8    rgb(247, 248, 248)
Text Secondary:    #D0D6E0    rgb(208, 214, 224)
Text Muted:        #8A8F98    rgb(138, 143, 152)

Accent:            #5E6AD2    rgb(94, 106, 210)
Accent Hover:      #5763C6    rgb(87, 99, 198)     filled-button hover, darkens
Accent Bright:     #828FFF    rgb(130, 143, 255)   indigo text on dark / on tint

Success:           #10B981    rgb(16, 185, 129)
Warning:           #E5A50A    rgb(229, 165, 10)
Danger:            #EB5757    rgb(235, 87, 87)
Special:           #8B5CF6    rgb(139, 92, 246)

Border Subtle:     rgba(255, 255, 255, 0.06)   decorative only
Border Default:    #6E7681    rgb(110, 118, 129)   interactive, 3:1+
Border Strong:     #8A8F98    rgb(138, 143, 152)

Ring Shadow:       0 0 0 1px var(--border-subtle)
Focus Ring:        2px solid var(--primary), offset 2px   full opacity

On filled base:    #08090A everywhere except primary/info, which take #FFFFFF
On 15% tint:       the base color, except primary -> #828FFF, special -> #A78BFA,
                   danger -> #F58787

Font:              Inter Variable (400 / 510 / 590)
Mono:              JetBrains Mono (400)
OpenType:          "cv01", "ss03"

Radius Default:    6px
Radius Card:       8px
Radius Pill:       9999px

Spacing Base:      4px
Easing:            cubic-bezier(0.4, 0, 0.2, 1)
Durations:         100ms fast / 180ms base / 240ms slow

Z-Index:           base 0, sticky 10, dropdown 20, overlay 30,
                   modal 40, toast 50, tooltip 60, toast 9999

Real stack:        cn() (clsx+tailwind-merge) for variants, hand-built ToastProvider,
                   hand-built command palette. No CVA / cmdk / Sonner / Radix / shadcn.
```

---

## 13. Coverage

§8 specifies these patterns:

Buttons | Cards | Inputs & Forms | Sidebar | Top Bar | Status Chips | Priority Badges 
Kanban | Chat & Messages | Dialogs | Dropdowns | Tooltips | Tables & Data Lists | Tabs 
Avatars | Progress | Toasts | Command Palette | Form Controls | Empty States | Loading 
Pagination | Filter Bars | Selection & Bulk Actions | Notification Rows | Count Badges 
Side Panel | Rich-Text Editor | Code & Log Viewers | Danger Zone | Attachments | Charts

**Deliberately unspecified**, because the app does not have them. Adding one means extending
this document first, not improvising at the call site: calendar / gantt / timeline views,
diff viewer, sliders, resizable panels, virtualised lists, breadcrumbs, steppers, carousels,
and a 404 page.

**The landing page is out of scope.** It is marketing, it is the only place Framer Motion is
allowed, and its hero imagery, ticker strip, and inverted CTA panel have no in-app equivalent.
It still obeys §3 (colour), §4 (weights), and §6 (radius).

---

## 14. Page Templates

Component and token docs above don't show how they compose into DevSync's actual screens —
this is that layer.

### Auth (`LoginPage`, `RegisterPage`)
| Element | Spec |
|---|---|
| Layout | Centered card, 400px max-width, vertically centered in viewport |
| Background | `--bg-canvas`, no chrome (no sidebar/topbar — pre-auth) |
| Card | `--bg-surface`, `--shadow-ring`, 8px radius, 32px padding |
| Logo | 32px, top of card, 24px below it |
| Heading | `--text-h2`, "Sign in to DevSync" / "Create your account" |
| Form | Stacked Inputs, 12px gap, full-width submit button |
| Switch link | "Don't have an account? Sign up" — `--text-caption`, `--primary` link, centered below card |
| OAuth buttons | Secondary/Outline variant, GitHub/Google icon + label, above the form, divided by a `--border-subtle` rule with "or" centered on it |

*(Once password reset ships: same card shell, single email field, "Check your email" success state reuses Empty States with a mail icon.)*

### Workspace Shell (`WorkspaceLayout` — wraps everything below)
| Element | Spec |
|---|---|
| Structure | Fixed 240px Sidebar + fixed 56px Top Bar + scrollable content region |
| Content region | `--bg-canvas`; full-bleed for Board/Backlog/Channel, 640px-constrained for Settings (§17) |
| Mobile (<1024px) | Sidebar becomes an overlay drawer (Side Panel pattern, left-anchored), triggered by a hamburger in the Top Bar |

### Board (`BoardPage`)
| Element | Spec |
|---|---|
| Header row | Project name (`--text-h1`) + key badge (mono, `--bg-inset`, 4px radius) left; Filter Bar + "New task" primary button right |
| Body | Horizontal-scrolling Kanban columns, fixed status order |

### Task Detail (opens from Board/Backlog)
| Element | Spec |
|---|---|
| Container | Side Panel, 480px, full-screen below 1024px |
| Header | Task key (mono, `--text-muted`) + editable title (`--text-h3`, click to edit inline) + close button |
| Body, in order | Status/Priority/Assignee row (inline Selects) -> Description (Rich-Text Editor) -> Sub-tasks -> Linked commits/PRs (small chips) -> Attachments -> Comments |
| Activity tab | Separate Underline tab — "Priya changed status to In Review — 2h ago", `--text-muted` |

### Channel (`ChannelPage`)
| Element | Spec |
|---|---|
| Structure | Header (56px, name + type icon + member count) -> scrollable message list -> Rich-Text Editor pinned to bottom |
| See also | Chat/Messages component spec in §8 for message grouping and bubble treatment |

### GitHub Integration (`GitHubIntegration`)
| Element | Spec |
|---|---|
| Not-connected | Empty state, GitHub icon, "Connect a repository", primary button -> OAuth |
| Connected header | Repo name + external-link icon, "Last synced Xm ago" `--text-muted`, disconnect as Ghost button |
| Tabs | Count tabs: Pull Requests / Issues / CI / Commits |
| PR/Issue row | Avatar + title (truncated) + state chip (§3 Domain Colors) + updated-at right-aligned |
| CI row | Status chip + workflow name + commit SHA (mono) + duration |

### Settings pages (Workspace/Project Settings, Members)
| Element | Spec |
|---|---|
| Layout | Single column, 640px max-width, left-aligned |
| Section | `--text-h2` + `--text-secondary` description, 24px gap, `--border-subtle` rule between sections |
| Danger Zone | Always last, extra 32px margin above |

---

## 15. Iconography

| Rule | Spec |
|---|---|
| Library | Lucide React exclusively |
| Stroke width | `1.75` for sizes 20px, `1.5` for 24px+ (Lucide's default 2 reads heavy at DevSync's compact sizes) |
| Sizing | 16 / 20 / 24 / 32px only — never an arbitrary size |
| Color | `--text-muted` at rest, `--text-primary` on hover/active, or the relevant ramp color when the icon *is* the status indicator |
| Icon-only buttons | Always require `aria-label` — a tooltip is not a substitute |
| Meaning consistency | One icon, one meaning, everywhere — `GitCommit` always means commit, `AtSign` always means mention |

---

## 16. Grid & Layout

| Context | Max-width | Notes |
|---|---|---|
| Full-bleed (Board, Backlog, Channel) | none | Fills space after the 240px sidebar |
| Settings / forms / auth | 640px | Line length past ~75ch hurts readability |
| Reading content (task description, PR body) | 720px | Independent of the panel's own width |
| Modal/dialog | 480px default, 640px content-heavy | Per §8 |

Gutter: 16px mobile, 24px desktop — uses `--space-4` / `--space-6`, no separate gutter token.

---

## 17. Content & Voice

- **State what happened, then what to do about it.** Not "Something went wrong" — "Couldn't load this board. Check your connection and try again."
- **No exclamation points, no "Oops," no forced friendliness** — match the visual restraint in §1.
- **Errors name the object, not just the action.** "Couldn't delete this task" beats "Delete failed."
- **Empty states describe the next action**, not just the absent state: "Create your first task to get started," not "No tasks yet."
- **Confirmations state the consequence.** "Delete this sprint? Tasks will return to the backlog." — not "Are you sure?"
- **Type-to-confirm strings match the object's real name**, not a generic "DELETE."

---

## 18. Accessibility Beyond Contrast

§3/§5's contrast and focus-ring work is thorough — this covers what's not contrast-related.

| Area | Requirement |
|---|---|
| Keyboard map | Every drag action (Kanban, backlog LexoRank) needs a keyboard equivalent — dnd-kit's keyboard sensor, not drag-only |
| Live regions | Incoming chat messages and notifications need `aria-live="polite"` — a screen reader user won't otherwise know something arrived |
| Focus return | Closing any Dialog/Drawer/Dropdown returns focus to the triggering element |
| Route change | Move focus to the new page's `<h1>` on navigation; SPAs routinely fail this |
| Skip link | Visually-hidden "Skip to content," first focusable element |
| Landmarks | `<nav>` sidebar, `<main>` content, `<header>` top bar — real semantic elements, not styled divs |
| Drag announcements | Custom text for dnd-kit's live region — "Task moved to In Progress, position 2 of 4" |

---

## 19. Out of Scope (deliberately)

Internationalization/RTL (single-language product today — if that changes, revisit §4's
negative-tracking values first), print styles, and a token versioning/changelog process
(worth adding once more than one person touches this doc — premature for a solo build).
