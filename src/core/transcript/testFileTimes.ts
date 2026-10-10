import { utimesSync } from 'node:fs'

/**
 * The time the tests start, in seconds since the epoch, so the files they
 * touch count as recently modified by a cache that reads the real clock.
 */
export const BASE_SECONDS = Math.floor(Date.now() / 1000)

/** A modification time an hour after the tests start, in seconds: later than any a growing transcript carries. */
export const LATER_SECONDS = BASE_SECONDS + 3600

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

/**
 * Sets a file's access and modification times to the same instant.
 * @param path - The file to touch.
 * @param seconds - The time to set, in seconds since the epoch.
 */
export function touchFile(path: string, seconds: number): void {
  utimesSync(path, seconds, seconds)
}
