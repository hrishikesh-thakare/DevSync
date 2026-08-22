import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
      // Single source of truth for colors: no hex/rgb/hsl literals outside
      // src/theme/colors.ts. Use token utilities or @/theme/colors imports.
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
    files: ['src/theme/colors.ts', 'scripts/**/*.mjs'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Vendored shadcn primitives. Each of these ships its `cva` recipe next to
    // the component it styles, which is what `npx shadcn add <name>` generates
    // and what call sites import. Splitting them into sibling files to satisfy
    // react-refresh would diverge from upstream and break regeneration, so the
    // three names are allowed explicitly rather than the rule being switched
    // off — a *new* non-component export in `ui/` still fails.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowExportNames: ['badgeVariants', 'buttonVariants', 'tabsListVariants'] },
      ],
    },
  },
])
