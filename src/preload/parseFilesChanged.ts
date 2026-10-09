import {
  MAX_CHANGED_DIR_NAME_LENGTH,
  MAX_CHANGED_FOLDERS,
  type FilesChangedDto
} from '../shared/ipc/filesChangedDto'

const KEYS = ['all', 'dirNames', 'foldersChanged']

/** Whether `name` is a plausible project folder name: bounded text that could not be a path. */
function isFolderName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_CHANGED_DIR_NAME_LENGTH &&
    !/[/\\\0]/.test(name) &&
    name !== '.' &&
    name !== '..'
  )
}

/**
 * Validates a files-changed payload from the main process. It is a hand-written
 * guard rather than a schema so the sandboxed preload bundles no dependency.
 *
 * @param payload - The value received over IPC, untrusted.
 * @returns The payload when it has exactly the expected shape, otherwise `null`.
 */
export function parseFilesChanged(payload: unknown): FilesChangedDto | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (Object.keys(payload).sort().join() !== KEYS.join()) return null
  const { dirNames, foldersChanged, all } = payload as Record<string, unknown>
  if (typeof foldersChanged !== 'boolean' || typeof all !== 'boolean') return null
  if (!Array.isArray(dirNames) || dirNames.length > MAX_CHANGED_FOLDERS) return null
  if (!dirNames.every(isFolderName)) return null
  return { dirNames, foldersChanged, all }
}
