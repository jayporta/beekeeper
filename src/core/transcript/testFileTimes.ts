/**
 * A modification time an hour before now, in seconds since the epoch: well
 * outside the window in which a transcript counts as recently modified, so a
 * test can make a transcript idle by setting it.
 *
 * @returns The time, in seconds.
 */
export function idleSeconds(): number {
  return Math.floor(Date.now() / 1000) - 3600
}

/** A modification time an hour after the tests start, in seconds: later than any a growing transcript carries. */
export const LATER_SECONDS = Math.floor(Date.now() / 1000) + 3600
