import { useLiveUpdates } from './useLiveUpdates'

/**
 * Keeps the visible lists and details current as transcripts change. It
 * renders nothing. Mount it once, inside the views that read the queries.
 *
 * @example
 * <LiveUpdates />
 */
export function LiveUpdates(): null {
  useLiveUpdates()
  return null
}
