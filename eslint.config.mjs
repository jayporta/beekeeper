import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

const NETWORK_MODULE_MESSAGE =
  'Beekeeper makes no network calls. See the no-network promise in the README.'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  eslintPluginJsxA11y.flatConfigs.strict,
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
    files: ['scripts/**/*.mjs', '.claude/hooks/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      // Plain JS has no type annotations to require; JSDoc carries the types.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  eslintConfigPrettier
)
