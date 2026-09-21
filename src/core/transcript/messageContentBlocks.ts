import { isRecordObject } from './isRecordObject'

/**
 * Reads a transcript record's `message.content` array, if it has one.
 * Works for both `assistant` and `user` records, since both nest their
 * content blocks the same way. Shape validation of individual blocks
 * happens next, against a specific block schema.
 *
 * @param record - A parsed transcript record.
 * @returns The content array, or `[]` when the record has no `message`, no
 * `content`, or `content` isn't an array.
 */
export function messageContentBlocks(record: Record<string, unknown>): readonly unknown[] {
  const { message } = record
  if (!isRecordObject(message)) return []

  const { content } = message
  return Array.isArray(content) ? content : []
}
