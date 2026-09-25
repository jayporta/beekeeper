import type { AgentTreeNode } from '../../core/session/agentTree'
import type { SessionScan } from '../../core/session/scanSession'

/** A small least-recently-used cache of completed session scans. */
export interface SessionScanCache {
  /**
   * Looks up a scan, marking it most recently used.
   * @param key - The scan key.
   * @returns The cached scan, or `undefined`.
   */
  get(key: string): SessionScan | undefined
  /**
   * Stores a scan unless it is incomplete, evicting the least recently used
   * entry beyond capacity.
   * @param key - The scan key.
   * @param scan - The scan.
   * @param subagentsListed - Whether the session's subagents folder was listed.
   */
  set(key: string, scan: SessionScan, subagentsListed: boolean): void
}

/** Options for {@link createSessionScanCache}. */
export interface SessionScanCacheOptions {
  /** The most scans kept. */
  readonly capacity: number
}

function hasMetaError(node: AgentTreeNode): boolean {
  return node.metaStatus.status === 'error' || node.children.some(hasMetaError)
}

/**
 * Whether a scan read everything it needed: no unreadable subagent
 * transcript and no unreadable meta file. Failures like these can clear
 * without the scan key changing, so they must not be cached.
 * @param scan - The scan.
 * @param subagentsListed - Whether the subagents folder was listed.
 * @returns `true` when the scan is safe to cache.
 */
function isCompleteScan(scan: SessionScan, subagentsListed: boolean): boolean {
  if (!subagentsListed) return false
  for (const report of scan.subagents.values()) if (!report.ok) return false
  return !hasMetaError(scan.tree)
}

/**
 * Creates a scan cache. Keys must cover every input file's identity; meta
 * files are assumed write-once, so the key tracks their presence and not
 * their contents. Only complete scans are stored.
 *
 * @param options - The capacity.
 * @returns The cache.
 */
export function createSessionScanCache(options: SessionScanCacheOptions): SessionScanCache {
  const entries = new Map<string, SessionScan>()
  return {
    get(key) {
      const scan = entries.get(key)
      if (scan === undefined) return undefined
      entries.delete(key)
      entries.set(key, scan)
      return scan
    },
    set(key, scan, subagentsListed) {
      if (!isCompleteScan(scan, subagentsListed)) return
      entries.delete(key)
      entries.set(key, scan)
      while (entries.size > options.capacity) {
        const oldest = entries.keys().next()
        if (oldest.done === true) return
        entries.delete(oldest.value)
      }
    }
  }
}
