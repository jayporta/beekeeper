import { projectDirNameSchema } from '../../shared/ipc/requestSchemas'

/** What one watch event says changed. */
export type FolderChange =
  | {
      readonly kind: 'folder'
      /** The project folder the event touched. */
      readonly dirName: string
      /** Whether the event is on the folder itself, not on something inside it. */
      readonly isFolderItself: boolean
    }
  | { readonly kind: 'unknown' }

/**
 * Maps a watch event's filename to the project folder it touched.
 *
 * @param filename - The event's path relative to the projects root, or `null` when the platform gave none.
 * @returns The folder, or `unknown` when there is no usable first segment (no filename, or a name that is not a valid project folder name).
 * @example
 * changedFolder('-Users-a/abc.jsonl') // { kind: 'folder', dirName: '-Users-a', isFolderItself: false }
 */
export function changedFolder(filename: string | null): FolderChange {
  const segments = (filename ?? '').split(/[/\\]/).filter((segment) => segment !== '')
  const dirName = projectDirNameSchema.safeParse(segments[0])
  if (!dirName.success) return { kind: 'unknown' }
  return { kind: 'folder', dirName: dirName.data, isFolderItself: segments.length === 1 }
}
