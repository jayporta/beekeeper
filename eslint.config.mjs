import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'
import eslintPluginUnicorn from 'eslint-plugin-unicorn'
import eslintPluginI18next from 'eslint-plugin-i18next'
import importDirection from './lint/importDirection.mjs'
import { importDirectionPolicy } from './lint/importDirectionPolicy.mjs'

const NETWORK_MODULE_MESSAGE =
  'Beekeeper makes no network calls. See the no-network promise in the README.'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out', '.claude/worktrees/**', '.remember/**'] },
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
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'http', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:http', message: NETWORK_MODULE_MESSAGE },
            { name: 'https', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:https', message: NETWORK_MODULE_MESSAGE },
            { name: 'net', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:net', message: NETWORK_MODULE_MESSAGE },
            { name: 'tls', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:tls', message: NETWORK_MODULE_MESSAGE },
            { name: 'dgram', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:dgram', message: NETWORK_MODULE_MESSAGE },
            { name: 'http2', message: NETWORK_MODULE_MESSAGE },
            { name: 'node:http2', message: NETWORK_MODULE_MESSAGE },
            {
              name: 'electron',
              importNames: ['net'],
              message: NETWORK_MODULE_MESSAGE
            }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NETWORK_MODULE_MESSAGE },
        { name: 'XMLHttpRequest', message: NETWORK_MODULE_MESSAGE },
        { name: 'WebSocket', message: NETWORK_MODULE_MESSAGE },
        { name: 'EventSource', message: NETWORK_MODULE_MESSAGE }
      ]
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
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
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
              'ns',
              'emptyReason'
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
        }
      ]
    }
  },
  {
    files: ['docs/**/*.js', 'lint/**/*.mjs'],
    rules: {
      // Plain JS has no type annotations to require; JSDoc carries the types.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
