---
name: strict-react-teardown
description: >-
  Use this skill when transitioning a project away from shadcn, building strict React UI components, or enforcing the DevSync dark-mode-only design system. It contains the exact templates, scripts, and rules for building zero-dependency components that pass the strict AGENTS.md audit.
---

# Strict React Teardown & Purist Design System

This skill empowers you to build highly customized, zero-dependency, mathematically sound UI components. It enforces a strict "no shadcn, no standard tailwind colors" policy and provides the exact templates and validation tools you need to succeed.

## Core Directives

When building components or pages for this project, you MUST strictly adhere to the rules documented in [AGENTS.md](./references/AGENTS.md).

Key overrides for your standard behavior:
1. **Never import from shadcn, radix-ui, or sonner.** All components must be hand-built using standard React state, Context, and Portals.
2. **Never use hardcoded hex or RGB colors in your components.** You must ONLY use semantic Tailwind aliases (e.g. `bg-card`, `text-foreground`, `border-input`).
3. **Never use standard Tailwind color names** (e.g., `text-red-500`, `bg-blue-600`).
4. **Never exceed 300ms for transitions.** Do not use `framer-motion` for ambient decoration; use CSS transitions for interactive states only.
5. **Never exceed 16px for typography.** The scale is `text-micro` (11px), `text-caption` (12px), `text-ui` (13px), `text-body` (14px), `text-heading` (16px).
6. **Strict Z-Indexes:** Never use raw `z-10` or `z-50`. Use ONLY `z-[var(--z-dropdown)]`, `z-[var(--z-overlay)]`, `z-[var(--z-modal)]`, `z-[var(--z-toast)]`, `z-[var(--z-tooltip)]`.

## Workflow & Tools

When tasked with rebuilding a component or converting a project to this design system, follow these steps:

### 1. Consult the Perfect Templates
Before generating a component, look at the reference implementations in the `templates/` folder:
- [button.tsx](./templates/button.tsx) - Shows how to implement strict `ghost` defaults and proper alias usage.
- [dialog.tsx](./templates/dialog.tsx) - Shows how to use Portals, strict z-indexes, focus-return logic, and backdrop scrims.
- [colors.ts](./templates/colors.ts) - The single source of truth for the strict mathematical color palette.
- [index.css](./templates/index.css) - How typography and alias mappings are defined in Tailwind v4 `@theme inline`.

### 2. Run the Cleanup Scripts
If you are transitioning legacy code, run these Node scripts:
- **`node .agents/skills/strict-react-teardown/scripts/deep-clean.mjs`**: Purges legacy shadcn aliases and over-sized typography.
- **`node .agents/skills/strict-react-teardown/scripts/fix-aliases.mjs`**: Replaces raw CSS variables (e.g. `bg-[var(--bg-canvas)]`) with the correct strict aliases (e.g. `bg-background`).

### 3. Verify with the Auditor
After making any UI changes, you MUST run the strict audit script. If it reports any violations, you must fix them before concluding your task:
```bash
node .agents/skills/strict-react-teardown/scripts/audit.mjs
```

By following this runbook, you will consistently generate bulletproof, accessible, and compliant React code.
