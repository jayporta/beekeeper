import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

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
          include: ['src/**/*.test.ts', 'lint/**/*.test.ts']
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
          setupFiles: ['src/renderer/src/testSetup.ts']
        }
      }
    ]
  }
})
