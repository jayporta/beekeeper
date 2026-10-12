import type { AgentTreeNode } from '../../core/session/agentTree'
import { canClearOnceQuiet, isTransientMetaFailure } from '../../core/session/metaFailureTransience'
import type { SubagentMetaFailureReason } from '../../core/session/subagentMetaStatus'
import type { SessionScan } from '../../core/session/scanSession'
import { createLruMap } from '../../core/shared/lruMap'

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

/** Whether a meta failure of this reason keeps a scan from counting as read. */
type BlocksScan = (reason: SubagentMetaFailureReason) => boolean

function hasMetaFailure(node: AgentTreeNode, blocks: BlocksScan): boolean {
  const { metaStatus } = node
  return (
    (metaStatus.status === 'error' && blocks(metaStatus.reason)) ||
    node.children.some((child) => hasMetaFailure(child, blocks))
  )
}

/** What decides whether a scan has a failure that blocks it. */
interface FailureCheck {
  /** Whether the session's subagents folder was listed. */
  readonly subagentsListed: boolean
  /** Which meta failures count against the scan. */
  readonly blocks: BlocksScan
}

function hasNoBlockingFailure(
  scan: SessionScan,
  { subagentsListed, blocks }: FailureCheck
): boolean {
  if (!subagentsListed) return false
  for (const report of scan.subagents.values()) if (!report.ok) return false
  return !hasMetaFailure(scan.tree, blocks)
}

/**
 * Whether a scan is safe to cache: a subagents folder that could be listed,
 * no unreadable subagent transcript, and no meta file that failed in a way
 * that can clear on a live session (see {@link isTransientMetaFailure}). Such
 * a failure can clear without the scan key changing, so it must not be
 * cached. A meta file that fails the same way on every read is cached, since
 * the key tracks its presence.
 * @param scan - The scan.
 * @param subagentsListed - Whether the subagents folder was listed.
 * @returns `true` when the scan is safe to cache.
 */
export function isCompleteScan(scan: SessionScan, subagentsListed: boolean): boolean {
  return hasNoBlockingFailure(scan, { subagentsListed, blocks: isTransientMetaFailure })
}

/**
 * Whether a scan of a session that has been quiet for the archive's waiting
 * period is safe to archive. It differs from {@link isCompleteScan} only in
 * which meta failures count: one blocks only when it can still clear on a
 * quiet session (see {@link canClearOnceQuiet}), so a scan with a settled
 * failure is archived instead of being rescanned for good.
 * @param scan - The scan.
 * @param subagentsListed - Whether the subagents folder was listed.
 * @returns `true` when the scan is safe to archive.
 */
export function isArchivableScan(scan: SessionScan, subagentsListed: boolean): boolean {
  return hasNoBlockingFailure(scan, { subagentsListed, blocks: canClearOnceQuiet })
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
  const entries = createLruMap<string, SessionScan>({
    maxWeight: options.capacity,
    weigh: () => 1
  })
  return {
    get: (key) => entries.get(key),
    set(key, scan, subagentsListed) {
      if (isCompleteScan(scan, subagentsListed)) entries.set(key, scan)
    }
  }
}
