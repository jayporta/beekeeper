import type { FileTouchDto } from '../../../../../shared/ipc/agentDto'

/** What happened to one path across all the agent's tool calls. */
export interface FileGroup {
  /** The path as the tools reported it. Render as plain text only. */
  readonly filePath: string
  /** The distinct operations done to the path, in the order first seen. */
  readonly operations: readonly FileTouchDto['operation'][]
  /** How many times a tool touched the path. */
  readonly touches: number
}

/**
 * Folds an agent's file touches into one group per path, so a file edited many
 * times is one row. Groups and operations keep the order they were first seen.
 *
 * @param touches - One entry per tool call per path.
 * @returns One group per distinct path.
 */
export function groupFileTouches(touches: readonly FileTouchDto[]): readonly FileGroup[] {
  const groups = new Map<
    string,
    { filePath: string; operations: FileTouchDto['operation'][]; touches: number }
  >()
  for (const { filePath, operation } of touches) {
    const group = groups.get(filePath)
    if (group === undefined) {
      groups.set(filePath, { filePath, operations: [operation], touches: 1 })
      continue
    }
    if (!group.operations.includes(operation)) group.operations.push(operation)
    group.touches += 1
  }
  return [...groups.values()]
}
