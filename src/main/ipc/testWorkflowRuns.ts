import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildAssistantRecord, buildJsonlText } from '../../core/transcript/testFixtures'
import { TEST_SESSION_ID, type IpcTestContext } from './testIpcTree'

/** Writes workflow runs into the test session of an {@link IpcTestContext}. */
export interface WorkflowRunFixtures {
  /**
   * Writes a workflow agent's transcript into a run folder of the test session.
   * @param runId - The run's folder name, such as `wf_a`.
   * @param agentId - The agent's id.
   */
  addWorkflowAgent(runId: string, agentId: string): Promise<void>
  /**
   * Writes a workflow run's record file in the test session.
   * @param runId - The run's id, such as `wf_a`.
   * @param record - The record, serialized as JSON.
   */
  writeRunRecord(runId: string, record: unknown): Promise<void>
}

/**
 * Binds workflow run fixtures to a test context. The context is read when a
 * fixture is written, so one binding serves every test of a file.
 * @param ctx - The file's test context, from `registerIpcTestTree`.
 * @returns The fixtures.
 */
export function createWorkflowRunFixtures(ctx: IpcTestContext): WorkflowRunFixtures {
  const sessionDir = (): string => join(dirname(ctx.tree.sessionPath), TEST_SESSION_ID)

  return {
    async addWorkflowAgent(runId, agentId) {
      const runDir = join(sessionDir(), 'subagents', 'workflows', runId)
      await mkdir(runDir, { recursive: true })
      await writeFile(
        join(runDir, `agent-${agentId}.jsonl`),
        buildJsonlText([buildAssistantRecord({ messageId: `msg_${agentId}` })])
      )
    },
    async writeRunRecord(runId, record) {
      const workflowsDir = join(sessionDir(), 'workflows')
      await mkdir(workflowsDir, { recursive: true })
      await writeFile(join(workflowsDir, `${runId}.json`), JSON.stringify(record))
    }
  }
}
