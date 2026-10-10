import { appendFileSync, utimesSync, writeFileSync } from 'node:fs'
import { buildSystemRecord } from '../signals/testSignalFixtures'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import { buildAssistantToolUseRecord, buildUserToolResultRecord } from '../testFileTouchFixtures'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord,
  buildQuotaRejectionRecord,
  toJsonlLine
} from '../testFixtures'
import { statWrittenTranscript } from '../testStatTranscript'
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

/** A transcript file that a test writes a little at a time, as a live session does. */
export interface GrowingTranscript {
  /** The file's absolute path. */
  readonly path: string
  /** How many bytes of the script are in the file. */
  written(): number
  /**
   * Appends the next slice of the script, between one byte and the step
   * limit long, then moves the file's modification time forward, so a stat
   * always tells it from the one before.
   * @returns Whether anything was appended, which is false once the whole script is in.
   */
  grow(): boolean
  /**
   * Appends the script up to a byte count, with the same modification time
   * step as {@link GrowingTranscript.grow}.
   * @param end - How many bytes of the script the file should hold; a count the file already holds appends nothing.
   */
  growTo(end: number): void
  /** The file as discovery would stat it now. */
  stat(): Promise<TranscriptFileInfo>
}

/** Options for {@link createGrowingTranscript}. */
export interface GrowingTranscriptOptions {
  /** Where to create the file. */
  readonly path: string
  /** The bytes the file grows into. */
  readonly script: Buffer
  /** Seeds the sequence of slice lengths, so a failing run can be repeated. */
  readonly seed: number
  /** The longest slice one `grow` appends, in bytes. */
  readonly maxStep: number
}

/** A small seeded generator (mulberry32) returning numbers in `[0, 1)`. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The first modification time a growing transcript carries, in seconds since
 * the epoch: the time the tests start, so a cache with the real clock always
 * counts the transcript as recently modified.
 */
const FIRST_MTIME_SECONDS = Math.floor(Date.now() / 1000)

/**
 * Creates an empty transcript file that grows into `script` in slices of
 * random length, so appends land mid-line and inside multi-byte characters.
 *
 * @param options - The file, the script, and the slice lengths.
 * @returns The growing transcript.
 */
export function createGrowingTranscript(options: GrowingTranscriptOptions): GrowingTranscript {
  const { path, script, maxStep } = options
  const random = seededRandom(options.seed)
  let written = 0
  let steps = 0
  writeFileSync(path, '')

  function growTo(end: number): void {
    const target = Math.min(end, script.length)
    if (target <= written) return
    appendFileSync(path, script.subarray(written, target))
    written = target
    steps += 1
    const seconds = FIRST_MTIME_SECONDS + steps
    utimesSync(path, seconds, seconds)
  }

  return {
    path,
    written: () => written,
    grow() {
      if (written >= script.length) return false
      growTo(written + 1 + Math.floor(random() * maxStep))
      return true
    },
    growTo,
    stat: () => statWrittenTranscript(path)
  }
}
