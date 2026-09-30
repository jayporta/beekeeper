import { isRecordObject } from './isRecordObject'
import { messageContentBlocks } from './messageContentBlocks'

/**
 * Reads the text a user record leads with: its `message.content` when that
 * is a string, otherwise the `text` of the first `text` block. Later blocks
 * are ignored, since a prefix check only means something at the start.
 *
 * @param record - A parsed user record.
 * @returns The leading text, or `null` when the record has none or the first
 * `text` block carries no string `text`.
 */
export function firstUserText(record: Record<string, unknown>): string | null {
  const { message } = record
  if (isRecordObject(message) && typeof message.content === 'string') return message.content

  const first = messageContentBlocks(record).find(
    (block) => isRecordObject(block) && block.type === 'text'
  )
  return isRecordObject(first) && typeof first.text === 'string' ? first.text : null
}
