import { join } from 'node:path'
import type { SubagentEntry } from '../transcript/discoverSubagents'
import { toAgentId } from '../transcript/ids'
import {
  createGrowingTranscript,
  type GrowingTranscript
} from '../transcript/testGrowingTranscript'

/** A session's transcripts on disk, each growing a little at a time. */
export interface GrowingSession {
  /** The lead transcript. */
  readonly lead: GrowingTranscript
  /**
   * Adds a subagent whose transcript grows into `script`.
   * @param agentId - The subagent's id.
   * @param script - The bytes its file grows into.
   * @returns The subagent's transcript.
   */
  addSubagent(agentId: string, script: string): GrowingTranscript
  /**
   * The options for `scanSession`, with the files as discovery would stat
   * them now.
   * @param order - The subagents to list, in order; every subagent added, in the order added, by default.
   */
  scanOptions(order?: readonly string[]): Promise<{ leadPath: string; subagents: SubagentEntry[] }>
}

/** Options for {@link createGrowingSession}. */
export interface GrowingSessionOptions {
  /** The directory to write the transcripts into. */
  readonly root: string
  /** The bytes the lead transcript grows into. */
  readonly leadScript: string
  /** Seeds the lengths of the random slices each transcript grows by. */
  readonly seed: number
  /** The longest random slice, in bytes. */
  readonly maxStep: number
}

/**
 * Creates a session with an empty lead transcript that grows into
 * `leadScript`.
 *
 * @param options - Where to write, the lead's script and how the files grow.
 * @returns The session, with no subagents yet.
 */
export function createGrowingSession(options: GrowingSessionOptions): GrowingSession {
  const { root, seed, maxStep } = options
  const subagents = new Map<string, GrowingTranscript>()
  const lead = createGrowingTranscript({
    path: join(root, 'lead.jsonl'),
    script: Buffer.from(options.leadScript),
    seed,
    maxStep
  })

  return {
    lead,
    addSubagent(agentId, script) {
      const transcript = createGrowingTranscript({
        path: join(root, `agent-${agentId}.jsonl`),
        script: Buffer.from(script),
        seed: seed + subagents.size + 1,
        maxStep
      })
      subagents.set(agentId, transcript)
      return transcript
    },
    async scanOptions(order = [...subagents.keys()]) {
      const entries: SubagentEntry[] = []
      for (const agentId of order) {
        const transcript = subagents.get(agentId)
        if (transcript === undefined) throw new Error(`Unknown subagent ${agentId}`)
        entries.push({
          agentId: toAgentId(agentId),
          transcript: await transcript.stat(),
          metaPath: null,
          workflowRunId: null
        })
      }
      return { leadPath: lead.path, subagents: entries }
    }
  }
}
