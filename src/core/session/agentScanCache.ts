import { createKeyedSerializer } from '../shared/keyedSerializer'
import { createLruMap } from '../shared/lruMap'
import {
  resumableScanWeight,
  resumeScan,
  startScan,
  type ResumableScan,
  type ScanReadTuning
} from '../transcript/resumableScan'
import type { TranscriptFileInfo } from '../transcript/statTranscriptFile'
import { agentIdentityKey, type AgentIdentity } from './agentIdentity'
import { createAgentScan, type AgentScan, type AgentScanSnapshot } from './agentScan'

/**
 * The default bound on the total weight of the scans an agent scan cache
 * keeps, in UTF-16 code units. A scan weighs its message reports, file
 * touches, signal events and spawns, so a real session's transcripts weigh a
 * few million all together, and this holds the sessions being watched at
 * once. A scan heavier than the bound, such as a crafted transcript with
 * tens of thousands of messages, is not kept and is read in full each time.
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
 * (see {@link resumableScanWeight}), and a scan heavier than the whole bound is
 * served but not kept. An entry is reused only while the file's `mtimeMs` and
 * `size` both match, the assumption the summary cache makes too.
 *
 * Reads of one path run one at a time, so overlapping reads of a growing
 * transcript never feed the same scan twice.
 *
 * @param options - The weight bound.
 * @returns An empty cache.
 */
export function createAgentScanCache(options: AgentScanCacheOptions = {}): AgentScanCache {
  const scans = createLruMap<string, ResumableScan<AgentScan>>({
    maxWeight: options.maxWeight ?? AGENT_SCAN_CACHE_MAX_WEIGHT,
    weigh: resumableScanWeight
  })
  const serializer = createKeyedSerializer()

  /**
   * Brings the transcript's scan up to date. The kept scan leaves the map
   * first, so a failure along the way leaves none behind.
   */
  async function update(request: ReadAgentScanOptions, key: string): Promise<AgentScanSnapshot> {
    const { file, identity, trackCostState, tuning } = request
    const previous = scans.get(key)
    if (previous?.mtimeMs === file.mtimeMs && previous.size === file.size) {
      return previous.scan.snapshot()
    }
    scans.delete(key)

    const resumed =
      previous === undefined ? null : await resumeScan({ file, resume: previous, tuning })
    const next =
      resumed ??
      (await startScan({ file, scan: createAgentScan({ identity, trackCostState }), tuning }))
    scans.set(key, next)
    return next.scan.snapshot()
  }

  return {
    read(request) {
      const { file, identity, trackCostState } = request
      const key = `${file.path}\0${agentIdentityKey(identity)}\0${trackCostState}`
      return serializer.run(key, () => update(request, key))
    }
  }
}
