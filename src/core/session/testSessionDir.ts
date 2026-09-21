import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import { toAgentId } from '../transcript/ids'

/** Options for {@link SessionScanDir.addSubagent}. */
export interface AddSubagentOptions {
  /** The subagent's synthetic transcript, written verbatim. */
  readonly transcript: string
  /**
   * The subagent's `.meta.json` contents. A string is written verbatim (so
   * a test can write invalid JSON); an object is serialized. Omitted means
   * no meta file is written, matching a subagent with no companion meta.
   */
  readonly meta?: string | Record<string, unknown>
}

/**
 * A throwaway directory holding a lead transcript and its subagents'
 * transcripts and meta files, for `scanSession` tests.
 */
export interface SessionScanDir {
  /** Writes the lead transcript and returns its path. */
  readonly writeLead: (content: string) => string
  /** Writes one subagent's transcript, and its meta file when given, and returns its entry. */
  readonly addSubagent: (agentId: string, options: AddSubagentOptions) => SubagentEntry
  /** Returns a subagent entry pointing at a path that was never written. */
  readonly missingSubagent: (agentId: string) => SubagentEntry
  /** Removes the directory and everything in it. */
  readonly cleanup: () => void
}

/**
 * Creates a fresh temp directory for `scanSession` tests to write synthetic
 * lead and subagent transcripts and meta files into.
 * @returns The directory and its helpers.
 */
export function createSessionScanDir(): SessionScanDir {
  const root = mkdtempSync(join(tmpdir(), 'beekeeper-session-scan-'))

  return {
    writeLead(content: string): string {
      const path = join(root, 'lead.jsonl')
      writeFileSync(path, content, 'utf-8')
      return path
    },
    addSubagent(agentId: string, options: AddSubagentOptions): SubagentEntry {
      const path = join(root, `agent-${agentId}.jsonl`)
      writeFileSync(path, options.transcript, 'utf-8')
      const stats = statSync(path)

      let metaPath: string | null = null
      if (options.meta !== undefined) {
        metaPath = join(root, `agent-${agentId}.meta.json`)
        const metaContent =
          typeof options.meta === 'string' ? options.meta : JSON.stringify(options.meta)
        writeFileSync(metaPath, metaContent, 'utf-8')
      }

      return {
        agentId: toAgentId(agentId),
        transcript: { path, mtimeMs: stats.mtimeMs, size: stats.size },
        metaPath
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
