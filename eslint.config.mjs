import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import eslintPluginI18next from 'eslint-plugin-i18next'
import {
  coreBannedGlobals,
  coreBannedImportPaths,
  coreBannedImportPatterns
} from './lint/coreNodeBans.mjs'
import importDirection from './lint/importDirection.mjs'
import { importDirectionPolicy } from './lint/importDirectionPolicy.mjs'
import {
  networkBannedGlobals,
  networkBannedImports,
  telemetryReceiverImports,
  telemetryReceiverTestImports
} from './lint/networkBans.mjs'

/** Only src/mod/register.ts talks to the engine; the rest of the mod gets a ModHost. */
const modEngineImport = {
  name: 'claude-code',
  message: 'Only src/mod/register.ts talks to the engine; lib gets a ModHost.'
}

/** The engine elements' props whose string values are layout or style names, not text. */
const MOD_LAYOUT_PROPS = [
  'flexDirection',
  'justifyContent',
  'alignItems',
  'borderStyle',
  'color',
  'wrap'
]

/**
 * The options for `i18next/no-literal-string`, shared by the renderer and the mod.
 *
 * @param {string[]} extraAttributes - JSX attributes, beyond the usual, whose values are not text.
 */
const noLiteralStringOptions = (extraAttributes) => ({
  // Checks string literals anywhere in JSX, attributes and component props included.
  // It does not see strings built in code (constants, helpers, `.ts` files), template
  // literals in props or children, or a `label` prop on any element, so reviewers check those.
  mode: 'jsx-only',
  // Setting an option replaces the plugin's default for it, so the defaults are restated
  // here, except the HTML entity names, which would need a deep import and match no text we use.
  'jsx-attributes': {
    exclude: [
      'className',
      'styleName',
      'style',
      'type',
      'key',
      'id',
      'width',
      'height',
      // Props whose values are identifiers or roles, not text.
      'role',
      'as',
      'ns',
      'emptyReason',
      ...extraAttributes
    ]
  },
  words: {
    exclude: [
      '[0-9!-/:-@[-`{-~]+',
      '[A-Z_-]+',
      /^\p{Emoji}+$/u,
      // The decorative, aria-hidden disclosure glyphs.
      '^[▾▸]$'
    ]
  }
})

export default defineConfig(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      '.claude/worktrees/**',
      '.remember/**',
      // Built by `npm run build:mod`, and written by the engine when it loads the mod. ESLint doesn't read .gitignore.
      'mod/hooks/*.js',
      'mod/.claude-plugin/types/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  eslintPluginJsxA11y.flatConfigs.strict,
  {
    rules: {
      // A scrollable region is a tab stop, so the keyboard can scroll it even when it holds no control.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['region'] }]
    }
  },
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react/no-danger': 'error',
      'no-restricted-imports': ['error', { paths: networkBannedImports }],
      'no-restricted-globals': ['error', ...networkBannedGlobals]
    }
  },
  {
    // core, service, shared and the mod run in Claude Code's engine, so they have no Node modules or globals outside
    // core's Node adapter. Rules in a later block replace an earlier block's options, so the network bans repeat here.
    files: [
      'src/core/**/*.ts',
      'src/service/**/*.ts',
      'src/shared/**/*.ts',
      'src/mod/**/*.{ts,tsx}'
    ],
    ignores: [
      'src/core/io/node/**',
      'src/core/**/__tests__/**',
      'src/core/**/test*.ts',
      'src/service/**/__tests__/**',
      'src/service/**/test*.ts',
      'src/shared/**/__tests__/**',
      'src/shared/**/test*.ts',
      'src/mod/**/__tests__/**',
      'src/mod/**/test*.ts'
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...networkBannedImports, ...coreBannedImportPaths, modEngineImport],
          patterns: coreBannedImportPatterns
        }
      ],
      'no-restricted-globals': ['error', ...networkBannedGlobals, ...coreBannedGlobals]
    }
  },
  {
    // register.ts is the one file that imports the engine's API. Its other bans stay.
    files: ['src/mod/register.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...networkBannedImports, ...coreBannedImportPaths],
          patterns: coreBannedImportPatterns
        }
      ]
    }
  },
  {
    // The opt-in telemetry receiver may import a node:http server, and every other network ban stays.
    files: ['src/main/otel/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: telemetryReceiverImports }]
    }
  },
  {
    // Its tests and test helpers may also import the client `request`, to send it exports.
    files: ['src/main/otel/__tests__/**/*.ts', 'src/main/otel/test*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: telemetryReceiverTestImports }]
    }
  },
  {
    // Dependencies run one way. Each key is a top folder under src, and its value is what it may not import.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { beekeeper: { rules: { 'import-direction': importDirection } } },
    rules: {
      'beekeeper/import-direction': ['error', importDirectionPolicy]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { unicorn: eslintPluginUnicorn },
    rules: {
      'unicorn/filename-case': ['error', { case: 'camelCase', checkDirectories: false }]
    }
  },
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/renderer/src/main.tsx'],
    rules: {
      'unicorn/filename-case': ['error', { case: 'pascalCase', checkDirectories: false }]
    }
  },
  {
    // Tests and test helpers are named after what they cover: a component or a hook.
    files: ['src/**/__tests__/**/*.tsx', 'src/**/test*.tsx'],
    rules: {
      'unicorn/filename-case': [
        'error',
        { cases: { camelCase: true, pascalCase: true }, checkDirectories: false }
      ]
    }
  },
  {
    files: ['src/renderer/src/**/*.tsx'],
    ignores: ['src/renderer/src/**/__tests__/**', 'src/renderer/src/**/test*.tsx'],
    plugins: { i18next: eslintPluginI18next },
    rules: { 'i18next/no-literal-string': ['error', noLiteralStringOptions([])] }
  },
  {
    // The mod draws with the engine's elements, whose layout props take string values that are not text.
    files: ['src/mod/**/*.tsx'],
    ignores: ['src/mod/**/__tests__/**', 'src/mod/**/test*.tsx'],
    plugins: { i18next: eslintPluginI18next },
    rules: { 'i18next/no-literal-string': ['error', noLiteralStringOptions(MOD_LAYOUT_PROPS)] }
  },
  {
    files: ['docs/**/*.js', 'lint/**/*.mjs', 'scripts/**/*.mjs'],
    rules: {
      // Plain JS has no type annotations to require; JSDoc carries the types.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
