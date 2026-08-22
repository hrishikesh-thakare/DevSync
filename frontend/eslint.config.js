import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.agents` holds skill templates, not application source. They are not
  // governed by the design system and tripping its rules there buried the real
  // findings under 54 template errors.
  globalIgnores(['dist', '.agents', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // AGENTS.md §2: "Never hardcode a hex, rgb(), or hsl() value in
      // .ts/.tsx. Every colour lives in src/theme/colors.ts. This is a lint
      // error, not a convention."
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/], Literal[value=/^(rgb|rgba|hsl|hsla)\\(/], TemplateLiteral[quasis.0.value.raw=/rgba\\(|hsla\\(|^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/]',
          message:
            'Do not hardcode colors. All color values live in src/theme/colors.ts; use Tailwind token utilities (bg-background, text-muted-foreground, ...) or import from @/theme/colors.',
        },
      ],
    },
  },
  {
    // The single source of truth for colour, and the build script that reads it.
    files: ['src/theme/colors.ts', 'scripts/**/*.mjs'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // `src/components/ui/` is hand-authored (AGENTS.md §2 — no shadcn, no CVA,
    // no Radix). `badgeVariants` is the one non-component export: a plain
    // object map of variant class strings, which is how §8 says to express
    // variants. Anything new here should be a component.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['badgeVariants', 'normalizePresence'] },
      ],
    },
  },
])
