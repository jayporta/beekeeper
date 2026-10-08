import { SYNTHETIC_MODEL_ID } from '../shared/syntheticModelId'
import { normalizeModelId } from './normalizeModelId'
import type { TokenCounts } from './tokenCounts'
import { totalTokenCount } from './totalTokenCount'

/**
 * Decides whether a message's usage counts toward usage over time, and how.
 * A message counts under its normalized model with its total across every
 * billing class. A message from the `<synthetic>` model, with no tokens, or
 * with a non-finite total does not count.
 *
 * @param message - The message's raw model id and token counts.
 * @returns The normalized model and total tokens, or `null` when the message does not count.
 */
export function countedUsage(message: {
  readonly model: string
  readonly tokens: TokenCounts
}): { readonly model: string; readonly tokens: number } | null {
  const model = normalizeModelId(message.model)
  if (model === SYNTHETIC_MODEL_ID) return null
  const tokens = totalTokenCount(message.tokens)
  return Number.isFinite(tokens) && tokens > 0 ? { model, tokens } : null
}
