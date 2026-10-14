import type { FileChanges } from '../../core/session/fileDiff/fileChange'
import type { FileTouch } from '../../core/session/fileTouchCollector'
import type { FileChangeDto, FileDiffDto } from '../../shared/ipc/fileDiffDto'

/** Input for {@link mapFileDiff}. */
export interface MapFileDiffOptions {
  /** The file the changes are for. */
  readonly filePath: string
  /** The agent's touches of the file, in the order it made them. */
  readonly touches: readonly FileTouch[]
  /** What the transcript recorded for those touches. */
  readonly changes: FileChanges
}

/**
 * Pairs each touch with the change its tool result recorded. A touch whose
 * result was not found reads as unrecorded.
 *
 * @param options - The file, the agent's touches of it, and the changes read.
 * @returns The diff, with one change per touch in touch order.
 */
export function mapFileDiff(options: MapFileDiffOptions): FileDiffDto {
  const { filePath, touches, changes } = options
  return {
    filePath,
    changes: touches.map((touch): FileChangeDto => {
      const { source, operation } = touch
      const change = changes.byToolUseId.get(touch.toolUseId)
      if (change === undefined || change.kind === 'unrecorded') {
        return { kind: 'unrecorded', source, operation }
      }
      return {
        kind: 'patch',
        source,
        operation,
        hunks: change.hunks,
        userModified: change.userModified,
        shared: change.shared
      }
    }),
    truncated: changes.truncated
  }
}
