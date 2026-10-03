import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Hashes the IPC contract: the contents of every `.ts` file directly in
 * `src/shared/ipc/`, in name order. The renderer uses it to discard a persisted
 * cache written under a different contract.
 */
function ipcContractHash(): string {
  const dir = resolve('src/shared/ipc')
  const hash = createHash('sha256')
  for (const name of readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .sort()) {
    hash.update(readFileSync(join(dir, name)))
  }
  return hash.digest('hex')
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: {
      __IPC_CONTRACT_HASH__: JSON.stringify(ipcContractHash())
    },
    build: {
      // The CSP allows fonts only from 'self', so a font file is never inlined as a data: URI.
      assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined)
    },
    plugins: [react()]
  }
})
