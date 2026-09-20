import { captureSystemError } from '../captureSystemError'
import { ok, type Result } from '../result'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import type { UnreadableError } from '../unreadableError'
import { scanSessionSummary } from './scanSessionSummary'
import type { SessionSummary } from './sessionSummary'

/** A cached summary, alongside the file state it was scanned from. */
interface CacheEntry {
  readonly mtimeMs: number
  readonly size: number
  readonly summary: SessionSummary
}

/**
 * Keeps the summary of each transcript it has scanned, so listing sessions
 * rereads only the files that changed.
 */
export interface SessionSummaryCache {
  /**
   * Returns a transcript's summary, scanning the file only when nothing is
   * cached for it or the cached scan is stale.
   *
   * @param file - The transcript, as discovery stat'd it.
   * @returns `ok` with the session's summary, or an `err` carrying only a
   * system error code when the file could not be read, as when it was
   * deleted between discovery and the scan.
   * @throws {Error} When the scan fails for a reason that carries no system
   * error code, since that indicates a bug rather than an unreadable file.
   */
  read(file: TranscriptFileInfo): Promise<Result<SessionSummary, UnreadableError>>
}

/**
 * Creates a summary cache keyed by transcript path, holding one entry per
 * transcript it has scanned and evicting none. An entry holds a capped
 * title, a cost total, two timestamps, and a count, so a `~/.claude` of a
 * few thousand sessions costs a few megabytes; an eviction policy waits
 * until there's an access pattern to base one on.
 *
 * An entry is reused only while the file's `mtimeMs` and `size` both match
 * the scan, which covers how transcripts change in practice: they're only
 * ever appended to, so their size grows. A rewrite that left both the size
 * and the modification time untouched would be served from the stale entry.
 * A failed scan is not cached.
 *
 * @returns A cache ready to read summaries through.
 */
export function createSessionSummaryCache(): SessionSummaryCache {
  const entries = new Map<string, CacheEntry>()

  return {
    async read(file: TranscriptFileInfo): Promise<Result<SessionSummary, UnreadableError>> {
      const cached = entries.get(file.path)
      if (cached !== undefined && cached.mtimeMs === file.mtimeMs && cached.size === file.size) {
        return ok(cached.summary)
      }

      const scanned = await captureSystemError(() => scanSessionSummary(file.path))
      if (!scanned.ok) return scanned

      entries.set(file.path, { mtimeMs: file.mtimeMs, size: file.size, summary: scanned.value })
      return scanned
    }
  }
}
