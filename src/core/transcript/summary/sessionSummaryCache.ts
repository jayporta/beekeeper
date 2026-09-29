import { createLruMap } from '../../shared/lruMap'
import { ok, type Result } from '../../shared/result'
import { captureSystemError } from '../captureSystemError'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import type { UnreadableError } from '../unreadableError'
import { scanSessionSummary } from './scanSessionSummary'
import type { SessionSummary } from './sessionSummary'
import { summaryWeight } from './summaryWeight'

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

/** Options for {@link createSessionSummaryCache}. */
export interface SessionSummaryCacheOptions {
  /**
   * The most total {@link summaryWeight}, in UTF-16 code units, the cache
   * keeps.
   * @defaultValue {@link SUMMARY_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
}

/**
 * The default bound on a summary cache's total weight, in UTF-16 code units.
 * A real entry weighs under about a thousand (the per-entry overhead plus a
 * few hundred code units of labels), so this holds several thousand of
 * them, where the largest real folder has about five hundred transcripts.
 * A crafted entry can weigh about 200 thousand (128 spawns of four strings
 * and 128 stops of two, each up to 256 code units), so the bound holds
 * about twenty of those. The strings it accounts for take at most 8 MB, at
 * two bytes per code unit.
 */
export const SUMMARY_CACHE_MAX_WEIGHT = 4_000_000

/**
 * Creates a summary cache keyed by transcript path. Entries are evicted
 * least recently used first once their total {@link summaryWeight} passes
 * the bound, so a deleted or rotated transcript's entry ages out and a
 * crafted transcript can't grow the cache past it. An entry heavier than
 * the whole bound is served but not kept. An evicted transcript is scanned
 * again on its next read.
 *
 * An entry is reused only while the file's `mtimeMs` and `size` both match
 * the scan, which covers how transcripts change in practice: they're only
 * ever appended to, so their size grows. A rewrite that left both the size
 * and the modification time untouched would be served from the stale
 * entry. A failed scan is not cached.
 *
 * @param options - The weight bound.
 * @returns A cache ready to read summaries through.
 */
export function createSessionSummaryCache(
  options: SessionSummaryCacheOptions = {}
): SessionSummaryCache {
  const entries = createLruMap<string, CacheEntry>({
    maxWeight: options.maxWeight ?? SUMMARY_CACHE_MAX_WEIGHT,
    weigh: (entry) => summaryWeight(entry.summary)
  })

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
