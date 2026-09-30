/// <reference types="vite/client" />

/**
 * A hash of the IPC contract in `src/shared/ipc/`, defined at build time. The
 * persisted query cache is discarded when it changes, so a cache written under
 * an older contract is never read as the current shape.
 */
declare const __IPC_CONTRACT_HASH__: string
