import { createKeyedSerializer } from '../../shared/keyedSerializer'
import { createLruMap } from '../../shared/lruMap'
import { ok, type Result } from '../../shared/result'
import { captureSystemError } from '../captureSystemError'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import type { UnreadableError } from '../unreadableError'
import { scanSessionSummary } from './scanSessionSummary'
import type { SessionSummary } from './sessionSummary'
import {
  resumeSummaryScan,
  resumeWeight,
  startSummaryScan,
  type SummaryReadTuning,
  type SummaryResume
} from './summaryResume'
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
  /**
   * The most total {@link resumeWeight}, in UTF-16 code units, the cache keeps
   * in scans it can carry on from.
   * @defaultValue {@link RESUME_CACHE_MAX_WEIGHT}
   */
  readonly maxResumeWeight?: number
  /** Stream tuning for the scans, mainly for tests. */
  readonly readOptions?: SummaryReadTuning
  /**
   * The clock that decides whether a transcript was modified recently enough
   * to keep a scan for, in epoch milliseconds, mainly for tests.
   * @defaultValue `Date.now`
   */
  readonly now?: () => number
}

/**
 * The default bound on a summary cache's total weight, in UTF-16 code units.
 * A real entry weighs about two thousand on average (the per-entry overhead,
 * its labels, and its lead usage's message ids and slots), and the largest
 * real one about 50 thousand, so this holds about five thousand average
 * entries. A crafted entry can weigh about 200 thousand in labels (128
 * spawns of four strings and 128 stops of two, each up to 256 code units)
 * plus up to about 14 million in message ids (50,000 ids of up to 256 code
 * units, each with its overhead); one heavier than the bound is served but
 * not kept. What it accounts for takes at most 20 MB, at two bytes per code
 * unit.
 */
export const SUMMARY_CACHE_MAX_WEIGHT = 10_000_000

/**
 * The default bound on the total weight of the scans a cache keeps to carry
 * on from, in UTF-16 code units. A scan weighs its message ids, signal events
 * and teammates: measured, a scan of 20 thousand messages weighs about 2.8
 * million and one of 50 thousand (the most message ids an observer tracks)
 * about 6.95 million, so this holds the handful of sessions that are growing
 * at once, even long ones. A scan heavier than the bound is not kept and is
 * scanned in full each time, as it would be without resuming. What it
 * accounts for takes at most 64 MB, at two bytes per code unit.
 */
export const RESUME_CACHE_MAX_WEIGHT = 32_000_000

/**
 * How long after its last modification, in milliseconds, a transcript still
 * counts as growing. Only a transcript modified within it has a scan kept to
 * carry on from; an older one is scanned in full, once, as it changes.
 */
export const RESUME_RECENT_MS = 10 * 60 * 1000

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
 * A transcript that has grown is not scanned again from the start. The cache
 * keeps the scan of each recently read transcript, in a second weight-bounded
 * map of its own (see {@link resumeWeight}), and reads only the bytes
 * appended since, which yields the summary a full scan of the longer file
 * would. It does so only when the file is the same one only longer (see
 * {@link resumeSummaryScan}); a shrink, a rewrite, a replaced file, or a
 * scan the second map evicted is scanned in full instead. A read that fails
 * drops the transcript's scan, since it may hold only some of the new lines.
 * Reads of one path run one at a time, so overlapping reads of a growing
 * transcript never feed the same scan twice.
 *
 * Only a transcript modified within {@link RESUME_RECENT_MS} of now has its
 * scan kept, and read for the mark that recognizes it later. An idle
 * session's transcript is scanned exactly as it would be without resuming,
 * with no scan retained and no extra open, so a project with many old
 * sessions pays nothing for the feature.
 *
 * @param options - The weight bounds, the read tuning, and the clock that decides which transcripts are recent.
 * @returns A cache ready to read summaries through.
 */
export function createSessionSummaryCache(
  options: SessionSummaryCacheOptions = {}
): SessionSummaryCache {
  const entries = createLruMap<string, CacheEntry>({
    maxWeight: options.maxWeight ?? SUMMARY_CACHE_MAX_WEIGHT,
    weigh: (entry) => summaryWeight(entry.summary)
  })
  const resumes = createLruMap<string, SummaryResume>({
    maxWeight: options.maxResumeWeight ?? RESUME_CACHE_MAX_WEIGHT,
    weigh: resumeWeight
  })
  const serializer = createKeyedSerializer()
  const tuning = options.readOptions
  const now = options.now ?? Date.now

  /**
   * Scans a transcript, carrying on from the scan kept for it when it can.
   * The kept scan leaves the map first, so a failure along the way leaves none
   * behind. A transcript not modified recently is scanned in full and kept
   * nowhere.
   */
  async function scan(file: TranscriptFileInfo): Promise<SessionSummary> {
    const previous = resumes.get(file.path)
    resumes.delete(file.path)
    if (now() - file.mtimeMs > RESUME_RECENT_MS) return scanSessionSummary(file.path, tuning)

    const resumed =
      previous === undefined ? null : await resumeSummaryScan({ file, resume: previous, tuning })
    const next = resumed ?? (await startSummaryScan({ file, tuning }))
    resumes.set(file.path, next)
    return next.scan.summary()
  }

  async function read(file: TranscriptFileInfo): Promise<Result<SessionSummary, UnreadableError>> {
    const cached = entries.get(file.path)
    if (cached !== undefined && cached.mtimeMs === file.mtimeMs && cached.size === file.size) {
      return ok(cached.summary)
    }

    const scanned = await captureSystemError(() => scan(file))
    if (!scanned.ok) return scanned

    entries.set(file.path, { mtimeMs: file.mtimeMs, size: file.size, summary: scanned.value })
    return scanned
  }

  return {
    read: (file) => serializer.run(file.path, () => read(file))
  }
}
