import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildEditToolUseResult,
  buildUserToolResultRecord
} from '../transcript/testFileTouchFixtures'
import { buildCostStateRecord, toJsonlLine } from '../transcript/testFixtures'
import { buildSpawnRecord } from './testSpawnFixtures'

/**
 * Synthetic transcript lines for tests that grow a session a little at a
 * time. Never derived from a real `~/.claude` transcript.
 */

const START_MS = Date.UTC(2026, 0, 1)

const line = (record: unknown): string => `${toJsonlLine(record)}\n`

/**
 * Builds the lines of one agent's steps from `range[0]` up to (not including) `range[1]`.
 * Every step is an assistant message that edits a file, with the result of
 * the edit. Every fifth step also runs a Bash command that changed a file,
 * every seventh result is an error, every ninth step spawns an agent, and
 * every thirteenth writes a cost state. Message ids and tool call ids are
 * named by `tag` and the step, so two agents given the same tag and steps
 * repeat each other's ids, as a fork repeats the lead's history.
 *
 * @param tag - Names the agent, and with the step makes each id.
 * @param range - The first step and the step to stop before.
 * @returns The steps' lines, ending in a newline.
 */
export function agentLines(tag: string, range: readonly [number, number]): string {
  let text = ''
  for (let step = range[0]; step < range[1]; step += 1) {
    const timestamp = new Date(START_MS + step * 60_000).toISOString()
    const editId = `toolu_${tag}_${step}`
    text += line(
      buildAssistantToolUseRecord({
        messageId: `msg_${tag}_${step}`,
        toolUseId: editId,
        toolName: 'Edit',
        timestamp
      })
    )
    text += line(
      buildUserToolResultRecord({
        toolUseId: editId,
        timestamp,
        isError: step % 7 === 0 ? true : undefined,
        toolUseResult: buildEditToolUseResult(`/repo/${tag}/${step}.ts`)
      })
    )
    if (step % 5 === 0) {
      const bashId = `toolu_${tag}_bash_${step}`
      text += line(
        buildAssistantToolUseRecord({
          messageId: `msg_${tag}_bash_${step}`,
          toolUseId: bashId,
          toolName: 'Bash',
          timestamp
        })
      )
      text += line(
        buildUserToolResultRecord({
          toolUseId: bashId,
          timestamp,
          toolUseResult: buildBashToolUseResult({ changedFiles: [`/repo/${tag}/bash${step}.ts`] })
        })
      )
    }
    if (step % 9 === 0) {
      text += line(
        buildSpawnRecord({
          toolUseIds: [`toolu_spawn_${tag}_${step}`],
          gitBranch: `branch-${step}`
        })
      )
    }
    if (step % 13 === 0) text += line(buildCostStateRecord({ totalCostUSD: step }))
  }
  return text
}

/**
 * Builds lines that each hold `count` tool calls, so a few lines make many
 * signal events. Ids are named by `tag`, the line and the call.
 *
 * @param tag - Names the agent, and with the line and the call makes each id.
 * @param range - The first line and the line to stop before.
 * @param count - How many tool calls each line holds.
 * @returns The lines, ending in a newline.
 */
export function toolCallLines(tag: string, range: readonly [number, number], count = 100): string {
  let text = ''
  for (let index = range[0]; index < range[1]; index += 1) {
    const content = Array.from({ length: count }, (_, call) => ({
      type: 'tool_use',
      id: `toolu_${tag}_${index}_${call}`,
      name: 'Read',
      input: {}
    }))
    text += line({
      type: 'assistant',
      message: {
        id: `msg_${tag}_${index}`,
        model: 'claude-opus-5',
        usage: { input_tokens: 1, output_tokens: 1 },
        content
      }
    })
  }
  return text
}

/**
 * The first `count` lines of a text.
 * @param text - Newline-terminated lines.
 * @param count - How many lines to keep.
 * @returns Those lines, ending in a newline.
 */
export function firstLines(text: string, count: number): string {
  return text.split('\n').slice(0, count).join('\n') + '\n'
}
