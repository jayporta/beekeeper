import { buildSystemRecord } from '../signals/testSignalFixtures'
import { buildAssistantToolUseRecord, buildUserToolResultRecord } from '../testFileTouchFixtures'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord,
  buildQuotaRejectionRecord,
  toJsonlLine
} from '../testFixtures'
import { buildTaskStopRecord, buildTeammateSpawnRecord } from '../testTeammateFixtures'

/**
 * The line cap a scan of {@link buildTrickyTranscript} should use: above every
 * ordinary line in it, below its oversized one.
 */
export const TRICKY_MAX_LINE_CHARS = 1000

/** The bytes of a UTF-8 byte order mark. */
const BYTE_ORDER_MARK = Buffer.from([0xef, 0xbb, 0xbf])

/** Options for {@link buildTrickyTranscript}. */
export interface TrickyTranscriptOptions {
  /** Begin the file with a byte order mark, which a full read drops. */
  readonly startWithBom?: boolean
}

/** One line of the script and how it ends. */
interface ScriptLine {
  readonly text: string
  readonly end: '\n' | '\r\n'
}

const lf = (text: string): ScriptLine => ({ text, end: '\n' })
const crlf = (text: string): ScriptLine => ({ text, end: '\r\n' })

/**
 * Builds a synthetic transcript that holds each thing a resumed scan has to
 * get right: multi-byte characters, CRLF line ends, blank lines, a byte order
 * mark that begins a line mid-file, lines that are not records, an oversized
 * line (past {@link TRICKY_MAX_LINE_CHARS}), repeated message ids, and an
 * unterminated final line. It exercises every part of a session summary.
 *
 * @param options - Whether the file also begins with a byte order mark.
 * @returns The file's bytes.
 */
export function buildTrickyTranscript(options: TrickyTranscriptOptions = {}): Buffer {
  const lines: ScriptLine[] = [
    lf(toJsonlLine(buildAiTitleRecord('Café ☕ 🐝 first'))),
    lf(
      toJsonlLine(
        buildAssistantRecord({ messageId: 'msg_1', timestamp: '2026-01-01T00:05:00.000Z' })
      )
    ),
    crlf(
      toJsonlLine(
        buildAssistantToolUseRecord({
          toolUseId: 'tool_1',
          toolName: 'Bash',
          input: { command: 'ls' }
        })
      )
    ),
    crlf(toJsonlLine(buildUserToolResultRecord({ toolUseId: 'tool_1', isError: true }))),
    lf(`\uFEFF${toJsonlLine(buildAiTitleRecord('After a byte order mark'))}`),
    lf(''),
    lf('garbage ☃ that is not json'),
    lf('[1,2,3]'),
    lf('€'.repeat(TRICKY_MAX_LINE_CHARS + 500)),
    lf(toJsonlLine(buildTeammateSpawnRecord({ name: 'scout', team: 'team-1' }))),
    lf(toJsonlLine(buildTaskStopRecord({ taskId: 'scout@team-1', toolUseId: 'toolu_stop' }))),
    lf(toJsonlLine(buildQuotaRejectionRecord())),
    lf(
      toJsonlLine(
        buildAssistantRecord({ messageId: 'msg_2', timestamp: '2026-01-01T00:01:00.000Z' })
      )
    ),
    lf(toJsonlLine(buildAssistantRecord({ messageId: 'msg_1', outputTokens: 99 }))),
    lf(toJsonlLine(buildCostStateRecord())),
    lf(toJsonlLine(buildSystemRecord({ subtype: 'compact_boundary', uuid: 'u1' }))),
    lf(
      toJsonlLine(buildAssistantRecord({ messageId: 'msg_pad', extra: { pad: 'é'.repeat(900) } }))
    ),
    lf(toJsonlLine(buildAiTitleRecord('Second ☕ title')))
  ]
  const body = lines.map((line) => line.text + line.end).join('')
  const text = `${body}{"type":"ai-title","aiTitle":"never finished`
  const bytes = Buffer.from(text, 'utf-8')
  return options.startWithBom === true ? Buffer.concat([BYTE_ORDER_MARK, bytes]) : bytes
}
