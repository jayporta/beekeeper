import type { ProcessPort } from './processPort'

let installed: ProcessPort | undefined

/**
 * Installs the adapter every core child process goes through; a later call replaces it.
 * @param port - The adapter to install.
 */
export function installProcessPort(port: ProcessPort): void {
  installed = port
}

/**
 * The installed adapter.
 * @returns The adapter set by {@link installProcessPort}.
 * @throws {Error} When nothing is installed, naming `installProcessPort`.
 */
export function processPort(): ProcessPort {
  if (installed === undefined) {
    throw new Error('No process port installed: call installProcessPort() at startup.')
  }
  return installed
}
