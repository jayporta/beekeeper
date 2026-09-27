import { toolResultBlockSchema, type ToolResultBlock } from './schemas'

/**
 * Parses a user record's content blocks as `tool_result` blocks, each
 * exactly once, and returns the sole match. A record with more than one is
 * ambiguous about which call a shared field refers to, so it matches none.
 *
 * @param blocks - The record's `message.content` blocks, unvalidated.
 * @returns The one parsed `tool_result` block, or `null` when none or more
 * than one of `blocks` validates as one.
 */
export function parseSoleToolResultBlock(blocks: readonly unknown[]): ToolResultBlock | null {
  let matchCount = 0
  let matched: ToolResultBlock | null = null

  for (const block of blocks) {
    const parsed = toolResultBlockSchema.safeParse(block)
    if (!parsed.success) continue
    matchCount += 1
    matched = parsed.data
  }

  return matchCount === 1 ? matched : null
}
