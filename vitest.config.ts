import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

/** Claude Code's worktrees hold full checkouts of other branches, with their own tests. */
const exclude = [...configDefaults.exclude, '.claude/worktrees/**']

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: { '@renderer': resolve('src/renderer/src') }
        },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'lint/**/*.test.ts'],
          exclude
        }
      },
      {
        resolve: {
          alias: { '@renderer': resolve('src/renderer/src') }
        },
        define: { __IPC_CONTRACT_HASH__: JSON.stringify('test-contract-hash') },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          exclude,
          setupFiles: ['src/renderer/src/testSetup.ts']
        }
      }
    ]
  }
})
