import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import { toAgentId } from '../transcript/ids'

/**
 * A throwaway directory holding a lead transcript and its subagents'
 * transcripts, for `scanSessionUsage` tests.
 */
export interface SessionUsageDir {
  /** Writes the lead transcript and returns its path. */
  readonly writeLead: (content: string) => string
  /** Writes one subagent's transcript and returns its entry. */
  readonly addSubagent: (agentId: string, content: string) => SubagentEntry
  /** Returns a subagent entry pointing at a path that was never written. */
  readonly missingSubagent: (agentId: string) => SubagentEntry
  /** Removes the directory and everything in it. */
  readonly cleanup: () => void
}

/**
 * Creates a fresh temp directory for `scanSessionUsage` tests to write
 * synthetic lead and subagent transcripts into.
 * @returns The directory and its helpers.
 */
export function createSessionUsageDir(): SessionUsageDir {
  const root = mkdtempSync(join(tmpdir(), 'beekeeper-session-usage-'))

  return {
    writeLead(content: string): string {
      const path = join(root, 'lead.jsonl')
      writeFileSync(path, content, 'utf-8')
      return path
    },
    addSubagent(agentId: string, content: string): SubagentEntry {
      const path = join(root, `agent-${agentId}.jsonl`)
      writeFileSync(path, content, 'utf-8')
      const stats = statSync(path)
      return {
        agentId: toAgentId(agentId),
        transcript: { path, mtimeMs: stats.mtimeMs, size: stats.size },
        metaPath: null
      }
    },
    missingSubagent(agentId: string): SubagentEntry {
      const path = join(root, `agent-${agentId}.jsonl`)
      return {
        agentId: toAgentId(agentId),
        transcript: { path, mtimeMs: 0, size: 0 },
        metaPath: null
      }
    },
    cleanup: () => rmSync(root, { recursive: true, force: true })
  }
}
