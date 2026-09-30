import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildAgentSettingRecord,
  buildAssistantRecord,
  buildJsonlText,
  buildUserRecord
} from '../../core/transcript/testFixtures'
import { buildTeammateSpawnRecord } from '../../core/transcript/testTeammateFixtures'
import { TEST_PROJECT, TEST_SESSION_ID } from './testIpcTree'

/** A worktree folder in the test project's family. */
export const WORKTREE = `${TEST_PROJECT}--claude-worktrees-feat`
/** The session id of the `scout` teammate. */
export const AGENT_SESSION_ID = '2b2b2b2b-2222-4222-8222-22222222222c'
/** The session id of a human session. */
export const HUMAN_SESSION_ID = '4d4d4d4d-4444-4444-8444-44444444444e'

/** A transcript to write into a project folder under the test home. */
export interface TranscriptToWrite {
  /** The project folder, created when missing. */
  readonly projectDirName: string
  /** The session id, which names the file. */
  readonly sessionId: string
  /** The records the transcript holds. */
  readonly records: readonly unknown[]
}

/**
 * Writes a transcript into a project folder of the synthetic `~/.claude`.
 *
 * @param home - The test tree's home directory.
 * @param transcript - The folder, session id, and records.
 */
export async function writeTranscript(home: string, transcript: TranscriptToWrite): Promise<void> {
  const dir = join(home, '.claude', 'projects', transcript.projectDirName)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${transcript.sessionId}.jsonl`), buildJsonlText(transcript.records))
}

/**
 * Writes the lead in the base folder, over the tree's session; it spawns
 * `scout` into `team-1`.
 *
 * @param home - The test tree's home directory.
 */
export async function writeLead(home: string): Promise<void> {
  await writeTranscript(home, {
    projectDirName: TEST_PROJECT,
    sessionId: TEST_SESSION_ID,
    records: [buildAssistantRecord(), buildTeammateSpawnRecord()]
  })
}

/**
 * The records of a teammate transcript for `scout` in `team-1`.
 *
 * @param cwd - The teammate's first cwd; none is recorded when omitted.
 * @returns The transcript records.
 */
export function scoutRecords(cwd?: string): unknown[] {
  return [
    buildAgentSettingRecord('Explore'),
    buildUserRecord({
      extra: { agentName: 'scout', teamName: 'team-1', ...(cwd === undefined ? {} : { cwd }) }
    })
  ]
}
