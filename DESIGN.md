# DevSync Design System

> A dark-only, Linear-inspired design system for a developer collaboration platform.
> Built on Tailwind CSS v4 + shadcn/ui + Radix primitives.
> Font stack: Inter Variable (UI) + JetBrains Mono (code).

---

## 1. Visual Theme & Atmosphere

DevSync treats darkness as its native medium. The canvas at `rgb(8, 9, 10)` is near-black with a faint warmth — not pure #000000, not GitHub's blue-tinted #0D1117, but a neutral charcoal that lets content float. Above it, a four-step surface ladder rises in single-digit RGB increments, creating depth through barely perceptible brightness shifts rather than shadows.

**This app is dark-only. There is no light mode. Do not add a light mode toggle, light theme tokens, or conditional light/dark styling.**

The sole chromatic accent is a muted indigo (`#5E6AD2`) — Linear's signature lavender-blue. It marks interactive elements (links, primary CTAs, focus rings) and nothing else. Functional colors for status and priority exist but are used sparingly: small chips, dot indicators, and badges — never as section backgrounds or large fills.

Typography uses Inter Variable at two non-standard weights: **510** (between regular and medium) for emphasis and **590** (between medium and semibold) for strong emphasis. These in-between weights create hierarchy that feels calibrated, not stepped. OpenType features `cv01` and `ss03` are enabled on all UI text for geometric precision.

The overall feel is: **dense, technical, quietly luxurious** — software that looks like it was built by engineers who care about craft.

---

## 2. Tech Stack Context

When generating code for DevSync, follow these architectural constraints:

| Layer | Technology | Notes |
|---|---|---|
| **Framework** | React + Vite | SPA, client-side routing via react-router-dom |
| **Styling** | Tailwind CSS v4 | Use utility classes, not raw CSS-in-JS |
| **Components** | shadcn/ui + Radix primitives | All UI primitives live in `src/components/ui/` |
| **Variants** | class-variance-authority (CVA) | Button, badge, etc. use CVA for variant management |
| **Tokens** | CSS custom properties | Defined in `src/theme/tokens.css`, sourced from `src/theme/colors.ts` |
| **Fonts** | Inter Variable + JetBrains Mono | Loaded via Google Fonts in `index.html` |
| **Icons** | Lucide React | Consistent icon set across all components |
| **Animation** | Framer Motion (landing page only) | In-app transitions use CSS transitions only |

**Rules for AI agents:**
- Always use Tailwind utility classes. Never write inline styles or `<style>` blocks.
- Always reference design tokens via CSS variables (e.g., `var(--bg-canvas)`). Never hardcode hex values.
- Always use existing shadcn/ui components from `src/components/ui/` before creating new ones.
- Always use `cn()` from `src/lib/utils` for conditional class merging.

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

| Token | Value | Role |
|---|---|---|
| `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Decorative dividers — card edges, section separators |
| `--border-default` | `rgba(255, 255, 255, 0.10)` | Interactive boundaries — inputs, outlined buttons (>=3:1 against surface) |
| `--border-strong` | `rgba(255, 255, 255, 0.16)` | Hover emphasis, focused borders |

### Text Hierarchy

| Token | Value | Hex | Role |
|---|---|---|---|
| `--text-primary` | `rgb(247, 248, 248)` | `#F7F8F8` | Headlines, primary content — near-white, not pure white |
| `--text-secondary` | `rgb(208, 214, 224)` | `#D0D6E0` | Descriptions, subtitles — cool blue-grey that recedes gracefully |
| `--text-muted` | `rgb(138, 143, 152)` | `#8A8F98` | Metadata, timestamps, auxiliary — deliberate dimness |
| `--text-disabled` | `rgb(98, 102, 109)` | `#62666D` | Disabled states, footnotes, quaternary text |
| `--text-inverse` | `rgb(8, 9, 10)` | `#08090A` | Dark text on light/accent backgrounds |
| `--text-on-accent` | `rgb(255, 255, 255)` | `#FFFFFF` | Pure white — reserved for text on colored backgrounds only |

### Brand & Accent

| Token | Value | Hex | Role |
|---|---|---|---|
| `--primary` | `rgb(94, 106, 210)` | `#5E6AD2` | Links, primary CTA, focus rings — muted indigo accent |
| `--primary-hover` | `rgb(130, 143, 255)` | `#828FFF` | Hovered primary buttons — lighter indigo |
| `--primary-muted` | `rgba(94, 106, 210, 0.15)` | — | Tinted backgrounds for primary selections, badges |
| `--primary-border` | `rgba(94, 106, 210, 0.40)` | — | Border for primary-tinted containers |

### Semantic Colors

Each semantic ramp has four tokens: base, foreground (text on base), muted (tinted background), and border.

| Ramp | Base | Hex | Foreground | Muted | Border | Usage |
|---|---|---|---|---|---|---|
| **Success** | `rgb(16, 185, 129)` | `#10B981` | `#08090A` | `rgba(16, 185, 129, 0.15)` | `rgba(16, 185, 129, 0.40)` | Done status, success alerts |
| **Warning** | `rgb(229, 165, 10)` | `#E5A50A` | `#08090A` | `rgba(229, 165, 10, 0.15)` | `rgba(229, 165, 10, 0.40)` | In Review, P1, caution alerts |
| **Danger** | `rgb(235, 87, 87)` | `#EB5757` | `#FFFFFF` | `rgba(235, 87, 87, 0.15)` | `rgba(235, 87, 87, 0.40)` | P0 Urgent, destructive actions, error states |
| **Info** | `rgb(94, 106, 210)` | `#5E6AD2` | `#FFFFFF` | `rgba(94, 106, 210, 0.15)` | `rgba(94, 106, 210, 0.40)` | Informational alerts (aliases primary) |
| **Special** | `rgb(139, 92, 246)` | `#8B5CF6` | `#FFFFFF` | `rgba(139, 92, 246, 0.15)` | `rgba(139, 92, 246, 0.40)` | Feature labels, special badges |

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

### Color Philosophy

- **Achromatic by default.** The interface is black, near-black, and near-white. Color is earned, not given.
- **Indigo is the only accent.** `#5E6AD2` marks interactive elements. No second accent color.
- **Status colors appear only in chips, dots, and small badges.** Never as section backgrounds or large fills.
- **All white text uses `#F7F8F8`, not `#FFFFFF`.** Pure white is reserved for text on colored backgrounds.
- **Borders use white-alpha, not gray hex.** `rgba(255, 255, 255, 0.08)` adapts to any dark surface without manual tuning.

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

Shadows are supplementary to the surface ladder, not the primary depth mechanism. Every shadow is pure black — no colored tints.

| Token | Value | Usage |
|---|---|---|
| `--shadow-ring` | `rgba(0, 0, 0, 0.33) 0 0 0 1px` | Ring shadow as border — contained elements (use instead of CSS border for cards/rows) |
| `--shadow-hairline` | `rgba(0, 0, 0, 0.03) 0px 1.2px 0px 0px` | Barely-there bottom edge definition |
| `--shadow-elevated` | `rgba(0,0,0,0) 0 8px 2px, rgba(0,0,0,0.01) 0 5px 2px, rgba(0,0,0,0.04) 0 3px 2px, rgba(0,0,0,0.07) 0 1px 1px, rgba(0,0,0,0.08) 0 0 1px` | Five-layer composite for dropdowns, modals |
| `--shadow-press` | `rgba(0, 0, 0, 0.4) 0px 1px 0px 0px` | Pressed/inset button state |

### Focus Ring

```css
/* 2px outline in primary at 50% opacity */
outline: 2px solid rgba(94, 106, 210, 0.5);
outline-offset: 2px;
```

Use this pattern for all keyboard-focusable elements. The 50% opacity prevents the focus ring from being too loud on the dark canvas.

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
| **Destructive** | `rgba(235, 87, 87, 0.15)` | `#EB5757` | none | 6px |
| **Destructive hover** | `rgba(235, 87, 87, 0.25)` | `#EB5757` | none | 6px |

Button text: `--text-button` (13px, weight 510). Height: 32px (default), 28px (small), 36px (large).

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
| Border | `--border-default` (`rgba(255, 255, 255, 0.10)`) |
| Text | `--text-secondary` |
| Placeholder | `--text-muted` |
| Font | 14px, weight 400 |
| Radius | 6px |
| Height | 36px (default), 32px (compact) |
| Focus | 2px outline `rgba(94, 106, 210, 0.5)`, remove border |

### Sidebar Navigation

| Property | Value |
|---|---|
| Background | `--bg-surface` |
| Width | 240px (collapsible) |
| Nav items text | 14px, weight 510, `--text-muted` |
| Active item | Background `--primary-muted`, text `--text-primary` |
| Hover item | Background `--bg-surface-hover`, text `--text-primary` |
| Section headers | 11px, weight 510, `--text-disabled`, letter-spacing +0.2px (eyebrow style) |
| Dividers | 1px `--border-subtle` |

### Top Bar / Header

| Property | Value |
|---|---|
| Background | `--bg-surface` |
| Height | 56px |
| Bottom border | `--border-subtle` |
| Search input | Ghost style, `--text-muted` placeholder |
| User avatar | 28px circle, `--radius-full` |

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
| P0 — Urgent | `rgba(235, 87, 87, 0.15)` | `#EB5757` |
| P1 — High | `rgba(229, 165, 10, 0.15)` | `#E5A50A` |
| P2 — Medium | `rgba(94, 106, 210, 0.15)` | `#5E6AD2` |
| P3 — Low | `--bg-surface-hover` | `--text-muted` |

### Kanban Board

| Element | Spec |
|---|---|
| Column background | `--bg-canvas` (sits at page level) |
| Column header | 13px, weight 510, `--text-muted`, with task count badge |
| Task card | `--bg-surface`, `--shadow-ring`, 8px radius, 16px padding |
| Task card hover | `--bg-surface-hover` |
| Task card dragging | `--shadow-elevated`, slight opacity (0.8), z-index overlay |
| Drop target | `--primary-muted` background, `--primary-border` dashed border |
| Column gap | 12px between columns |
| Card gap | 8px between cards |

### Chat / Messages

| Element | Spec |
|---|---|
| Message area background | `--bg-canvas` |
| Message bubble (own) | `--bg-surface` — no special "sent" color |
| Message bubble (other) | `--bg-surface` — same as own, differentiated by alignment/avatar |
| Message text | 15px, weight 400, `--text-primary` |
| Timestamp | 12px, weight 400, `--text-muted` |
| Chat input area | `--bg-surface-hover` background, `--border-default` border |
| @mention chip | Background `rgba(94, 106, 210, 0.15)`, text `#6D78D5` |
| Code in messages | Background `rgba(255, 255, 255, 0.05)`, border `--border-subtle`, 2px radius, JetBrains Mono |
| Reactions | `--bg-surface-hover`, pill radius, 12px text |

### Dialogs & Modals

| Property | Value |
|---|---|
| Overlay | `rgba(0, 0, 0, 0.70)` |
| Panel background | `--bg-surface-raised` |
| Panel radius | 8px |
| Panel shadow | `--shadow-elevated` |
| Title | 16px, weight 590, `--text-primary` |
| Enter animation | Scale from 0.96 to 1.0, opacity 0 to 1, duration 200ms, ease `cubic-bezier(0.4, 0, 0.2, 1)` |

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

### Tables & Data Lists

| Element | Spec |
|---|---|
| Header row | `--text-muted`, 12px, weight 510, uppercase or eyebrow style |
| Body row | `--bg-canvas` base, `--bg-surface` on hover |
| Row border | `--border-subtle` bottom only |
| Cell text | 14px, weight 400, `--text-secondary` |
| Selected row | `--primary-muted` background |

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
- **No ambient animations.** No pulsing, floating, or continuously moving elements in the app UI. Loading spinners are exempt.
- **Respect `prefers-reduced-motion`**: collapse all animations to 1ms, keep spinners at reduced speed.

---

## 10. Do's and Don'ts

### Do

- **Use the 510/590 weight pair.** These in-between weights are the design's signature. `font-[510]` for emphasis, `font-[590]` for headings.
- **Build depth through surface color, not shadows.** The difference between `#08090A` and `#0F1011` IS the elevation.
- **Use `rgba(255, 255, 255, 0.08)` borders** as the universal separator. One value for header borders, card edges, input fields.
- **Use ring shadows for contained elements** (`0 0 0 1px`) instead of CSS `border`. They render more consistently and blend with the dark canvas.
- **Enable `cv01` and `ss03`** OpenType features on all UI text. Omit them on code and inputs.
- **Tighten letter-spacing as size increases.** `-0.24px` at 20px, `-0.6px` at 24px, `-1.0px` at 40px.
- **Keep status/priority colors in small chips only.** 12px text, pill radius, 2px 8px padding.
- **Use `--text-primary` (#F7F8F8) for important text**, not pure white.

### Don't

- **Don't add a light mode.** This app is dark-only.
- **Don't use `font-bold` or `font-semibold`.** The heaviest weight is 590. Use `font-[510]` or `font-[590]`.
- **Don't use border-radius above 8px** on rectangular UI elements. No 12px cards, no 16px panels.
- **Don't use colored shadows.** Every shadow is `rgba(0, 0, 0, ...)`. No tinted glows.
- **Don't use gradients** for backgrounds, cards, or buttons. Flat surfaces only.
- **Don't use status colors as section backgrounds.** Red, green, amber are for small indicators only.
- **Don't use `#000000` true black as the canvas.** Use `#08090A` — the faint warmth matters.
- **Don't use `#FFFFFF` for body text.** Use `#F7F8F8`. Pure white is for text on colored backgrounds only.
- **Don't animate hover states with scale, translate, or opacity.** Color changes only.
- **Don't introduce a second accent color.** Indigo (`#5E6AD2`) is the only accent.

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
Accent Hover:      #828FFF    rgb(130, 143, 255)

Success:           #10B981    rgb(16, 185, 129)
Warning:           #E5A50A    rgb(229, 165, 10)
Danger:            #EB5757    rgb(235, 87, 87)
Special:           #8B5CF6    rgb(139, 92, 246)

Border:            rgba(255, 255, 255, 0.08)
Ring Shadow:       rgba(0, 0, 0, 0.33) 0 0 0 1px

Font:              Inter Variable (400 / 510 / 590)
Mono:              JetBrains Mono (400)
OpenType:          "cv01", "ss03"

Radius Default:    6px
Radius Card:       8px
Radius Pill:       9999px

Spacing Base:      4px
Easing:            cubic-bezier(0.4, 0, 0.2, 1)
```
