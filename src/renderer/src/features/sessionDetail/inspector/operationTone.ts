import type { FileTouchDto } from '../../../../../shared/ipc/agentDto'
import type { PillTone } from '@renderer/components/Pill'

/** The pill tone of each thing a tool can do to a file. */
const TONES: Record<FileTouchDto['operation'], PillTone> = {
  create: 'success',
  edit: 'edit',
  update: 'edit',
  delete: 'error',
  change: 'neutral'
}

/**
 * The tone of the pill that names what a tool did to a file: created is
 * green, edited or updated is blue, deleted is red, and a change whose detail
 * isn't known is neutral.
 *
 * @param operation - What the tool did.
 * @returns The pill tone.
 */
export function operationTone(operation: FileTouchDto['operation']): PillTone {
  return TONES[operation]
}
