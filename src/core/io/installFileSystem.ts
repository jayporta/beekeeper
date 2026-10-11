import type { FileSystemPort } from './fileSystemPort'

let installed: FileSystemPort | undefined

/**
 * Installs the adapter every core read goes through; a later call replaces it.
 * @param port - The adapter to install.
 */
export function installFileSystem(port: FileSystemPort): void {
  installed = port
}

/**
 * The installed adapter.
 * @returns The adapter set by {@link installFileSystem}.
 * @throws {Error} When nothing is installed, naming `installFileSystem`.
 */
export function fileSystem(): FileSystemPort {
  if (installed === undefined) {
    throw new Error('No file system installed: call installFileSystem() at startup.')
  }
  return installed
}
