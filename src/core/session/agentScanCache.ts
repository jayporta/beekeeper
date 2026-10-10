import { createKeyedSerializer } from '../shared/keyedSerializer'
import { createLruMap } from '../shared/lruMap'
import {
  advanceScan,
  isRecentlyModified,
  resumableScanWeight,
  type ResumableScan,
  type ScanReadTuning
} from '../transcript/resumableScan'
import type { TranscriptFileInfo } from '../transcript/statTranscriptFile'
import { agentIdentityKey, type AgentIdentity } from './agentIdentity'
import { createAgentScan, type AgentScan, type AgentScanSnapshot } from './agentScan'

/**
 * The default bound on the total weight of the scans an agent scan cache
 * keeps, in UTF-16 code units. A scan weighs its message reports, file
 * touches, signal events and spawns: measured, a lead of 5 thousand messages
 * weighs about 1.2 million, one of 20 thousand about 3.8 million, and one of
 * 50 thousand about 8.8 million, so this holds the handful of sessions that
 * are growing at once, even long ones. A scan is kept only if it weighs no
 * more than a quarter of the bound (see `KEPT_SCAN_BOUND_SHARE`), 8 million
 * here, which a lead of about 45 thousand messages reaches. A heavier one is
 * read in full each time, so it cannot push every other session's scan out.
 * What it accounts for takes at most 64 MB, at two bytes per code unit.
 */
export const AGENT_SCAN_CACHE_MAX_WEIGHT = 32_000_000

/** Options for {@link createAgentScanCache}. */
export interface AgentScanCacheOptions {
  /**
   * The most total weight, in UTF-16 code units, the cache keeps.
   * @defaultValue {@link AGENT_SCAN_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
  /**
   * The clock that decides whether a transcript was modified recently enough
   * to keep a scan for, in epoch milliseconds, mainly for tests.
   * @defaultValue `Date.now`
   */
  readonly now?: () => number
}

/** Options for {@link AgentScanCache.read}. */
export interface ReadAgentScanOptions {
  /** The transcript, as discovery stat'd it. */
  readonly file: TranscriptFileInfo
  /** The agent whose transcript it is. */
  readonly identity: AgentIdentity
  /** Whether to track the transcript's `cost-state`, which only the lead's is read for. */
  readonly trackCostState: boolean
  /** Stream tuning, mainly for tests. */
  readonly tuning?: ScanReadTuning
  /**
   * The lead transcript of the session this transcript belongs to. A scan is
   * kept while the lead or the transcript itself was modified recently, so a
   * subagent that finished and went idle is still read only from where it
   * stopped while its session is live, and one still writing keeps its scan
   * while the lead waits. When both are idle nothing is kept.
   * @defaultValue none, so the transcript is judged by its own last modification
   */
  readonly sessionLead?: TranscriptFileInfo
}

/**
 * Keeps the scan of each transcript it has read, so a session detail scan
 * reads only what a growing transcript gained since the last one.
 */
export interface AgentScanCache {
  /**
   * Returns what a transcript shows. A transcript unchanged since the cached
   * scan is not read at all, and one that only grew is read from where the
   * scan stopped. Anything else, such as a shrink, a rewrite or a replaced
   * file, is scanned in full. The result equals what a scan of the whole file
   * from its first byte shows.
   *
   * @param options - The transcript, whose agent it is, and read tuning.
   * @returns A snapshot that later reads never change.
   * @throws {Error} When the transcript cannot be read, carrying the system
   * error code for an unreadable file. A failed read drops the transcript's
   * scan, since it may hold only some of the new lines.
   */
  read(options: ReadAgentScanOptions): Promise<AgentScanSnapshot>
}

/**
 * Creates an agent scan cache keyed by transcript path and agent. Scans are
 * evicted least recently used first once their total weight passes the bound
 * (see {@link resumableScanWeight}). An entry is reused only while the file's
 * `mtimeMs` and `size` both match, the assumption the summary cache makes too.
 *
 * Only the transcripts of a recently modified session, and a recently
 * modified transcript of any session, have their scans kept (see
 * `ReadAgentScanOptions.sessionLead`), and not one weighing more than a
 * quarter of the bound (see {@link advanceScan}), so an idle session's
 * transcripts and a very long one are read in full, with nothing retained.
 * Reads of one path run one at a time, so overlapping reads of a growing
 * transcript never feed the same scan twice.
 *
 * @param options - The weight bound and the clock.
 * @returns An empty cache.
 */
export function createAgentScanCache(options: AgentScanCacheOptions = {}): AgentScanCache {
  const scans = createLruMap<string, ResumableScan<AgentScan>>({
    maxWeight: options.maxWeight ?? AGENT_SCAN_CACHE_MAX_WEIGHT,
    weigh: resumableScanWeight
  })
  const serializer = createKeyedSerializer()
  const now = options.now ?? Date.now

  async function update(request: ReadAgentScanOptions, key: string): Promise<AgentScanSnapshot> {
    const { file, identity, trackCostState, tuning } = request
    const kept = scans.get(key)
    if (kept?.mtimeMs === file.mtimeMs && kept.size === file.size) return kept.scan.snapshot()

    const scan = await advanceScan({
      states: scans,
      key,
      file,
      createScan: () => createAgentScan({ identity, trackCostState }),
      recent:
        isRecentlyModified(file, now) ||
        (request.sessionLead !== undefined && isRecentlyModified(request.sessionLead, now)),
      tuning
    })
    return scan.snapshot()
  }

  return {
    read(request) {
      const { file, identity, trackCostState } = request
      const key = `${file.path}\0${agentIdentityKey(identity)}\0${trackCostState}`
      return serializer.run(key, () => update(request, key))
    }
  }
}
