import { resolve } from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

/** Claude Code's worktrees hold full checkouts of other branches, with their own tests. */
const exclude = [...configDefaults.exclude, '.claude/worktrees/**']

/** The mod runs in Claude Code's engine, not Node or jsdom, so it has its own project. */
const excludeMod = [...exclude, 'src/mod/**']

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
          exclude: excludeMod,
          setupFiles: ['src/core/io/node/testInstallNodeAdapters.ts']
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
          // Each file still builds its own jsdom in its own VM context. The gain is reusing the
          // worker and its module and code caches instead of forking afresh for every file.
          pool: 'vmThreads',
          include: ['src/**/*.test.tsx'],
          exclude: excludeMod,
          setupFiles: ['src/renderer/src/testSetup.ts']
        }
      },
      {
        // The mod's JSX calls the engine's global `h`, which tests install themselves.
        esbuild: { jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' },
        test: {
          name: 'mod',
          environment: 'node',
          include: ['src/mod/**/*.test.{ts,tsx}'],
          exclude
        }
      }
    ]
  }
})
