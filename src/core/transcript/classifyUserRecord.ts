import { detachFromParent } from './detachFromParent'
import { firstUserText } from './firstUserText'
import { toAgentId, type AgentId } from './ids'
import { isRecordObject } from './isRecordObject'
import { messageContentBlocks } from './messageContentBlocks'
import { MAX_IDENTIFIER_CODE_UNITS } from './schemas/boundedIdentifier'
import { isWithinCodeUnits } from '../shared/isWithinCodeUnits'

/**
 * What a lead transcript's `user` record is. `human` is a prompt a person
 * typed, or a record with no signal saying otherwise. The rest are input the
 * harness or another agent produced.
 */
export type UserRecordClass =
  /** A prompt a person typed, or a record with no signal saying otherwise. */
  | { kind: 'human' }
  /** A message another Claude session sent to this one. */
  | { kind: 'teammate-message' }
  /** A subagent's final report handed back to the session that delegated to it. */
  | {
      kind: 'subagent-handback'
      /** The subagent's id, when the record names one. */
      from?: AgentId
      /** The subagent's task id, when the record names one. */
      senderTaskId?: string
    }
  /** A notice that a background task finished. */
  | {
      kind: 'task-notification'
      /** The `<tool-use-id>` the notification reports on, when its header carries a valid one. */
      toolUseId?: string
    }
  /** A prompt the harness sent to continue the session on its own. */
  | { kind: 'auto-continuation' }
  /** A tool call's result reported back to the model. */
  | { kind: 'tool-result' }
  /** Harness bookkeeping: a caveat, a reminder, command output, or an interrupt marker. */
  | { kind: 'meta' }
  /** Not a `user` record, malformed, or carrying an origin value this reader doesn't know. */
  | { kind: 'unknown' }

const UNKNOWN: UserRecordClass = Object.freeze({ kind: 'unknown' })

/** The origin signals both `turnOrigin` and `origin.kind` resolve to. */
type OriginSignal = 'human' | 'peer' | 'task-notification' | 'auto-continuation'

/** `turnOrigin` spells its values with underscores. */
const TURN_ORIGIN_SIGNALS: ReadonlyMap<string, OriginSignal> = new Map([
  ['human', 'human'],
  ['peer', 'peer'],
  ['task_notification', 'task-notification'],
  ['auto_continuation', 'auto-continuation']
])

/** `origin.kind` spells its values with hyphens. */
const ORIGIN_KIND_SIGNALS: ReadonlyMap<string, OriginSignal> = new Map([
  ['human', 'human'],
  ['peer', 'peer'],
  ['task-notification', 'task-notification'],
  ['auto-continuation', 'auto-continuation']
])

const TASK_NOTIFICATION_PREFIX = '<task-notification>'
const RELAY_PREFIX = 'Another Claude session sent a message'
const META_PREFIXES = [
  '<local-command-stdout>',
  '<local-command-stderr>',
  '<bash-stdout>',
  '<bash-stderr>',
  '[Request interrupted'
] as const
/** Where a task notification's header ends: its free text follows. */
const BODY_TAGS = ['<summary>', '<result>'] as const

/** A tool-use id as the API issues it, such as `toolu_01ABC...`. */
const TOOL_USE_ID_SHAPE = /^toolu_[A-Za-z0-9_-]+$/
const TOOL_USE_ID_TAG = /<tool-use-id>([^<]*)<\/tool-use-id>/

/**
 * Resolves one of the origin fields to a signal. An absent field is `null`
 * (no signal) and a present value outside `signals` is `'unknown'`.
 */
function readSignal(
  value: unknown,
  signals: ReadonlyMap<string, OriginSignal>
): OriginSignal | 'unknown' | null {
  if (value === undefined) return null
  if (typeof value !== 'string') return 'unknown'
  return signals.get(value) ?? 'unknown'
}

function originOf(record: Record<string, unknown>): Record<string, unknown> | null {
  return isRecordObject(record.origin) ? record.origin : null
}

/** A non-empty string within the identifier cap, else `undefined`. */
function readIdentifier(value: unknown): string | undefined {
  return isWithinCodeUnits(value, MAX_IDENTIFIER_CODE_UNITS) && value !== '' ? value : undefined
}

/** Builds the hand-back or teammate-message class from the record's `origin`. */
function classifyPeer(origin: Record<string, unknown> | null): UserRecordClass {
  if (origin?.handback !== true) return { kind: 'teammate-message' }

  const from = readIdentifier(origin.from)
  const senderTaskId = readIdentifier(origin.senderTaskId)
  return {
    kind: 'subagent-handback',
    ...(from !== undefined && { from: toAgentId(from) }),
    ...(senderTaskId !== undefined && { senderTaskId })
  }
}

/**
 * Reads the `<tool-use-id>` a task notification names, from its header only:
 * the text after `<summary>` or `<result>` is untrusted free text. Only a
 * value shaped like a tool-use id and within the identifier cap is returned,
 * copied so it doesn't keep the notification alive.
 */
function classifyTaskNotification(text: string | null): UserRecordClass {
  if (text === null) return { kind: 'task-notification' }

  const bodyStarts = BODY_TAGS.map((tag) => text.indexOf(tag)).filter((index) => index >= 0)
  const header = bodyStarts.length === 0 ? text : text.slice(0, Math.min(...bodyStarts))
  const candidate = TOOL_USE_ID_TAG.exec(header)?.[1]
  if (
    candidate === undefined ||
    !isWithinCodeUnits(candidate, MAX_IDENTIFIER_CODE_UNITS) ||
    !TOOL_USE_ID_SHAPE.test(candidate)
  ) {
    return { kind: 'task-notification' }
  }
  return { kind: 'task-notification', toolUseId: detachFromParent(candidate) }
}

function fromSignal(
  signal: OriginSignal | 'unknown',
  record: Record<string, unknown>
): UserRecordClass {
  switch (signal) {
    case 'human':
      return { kind: 'human' }
    case 'peer':
      return classifyPeer(originOf(record))
    case 'task-notification':
      return classifyTaskNotification(firstUserText(record))
    case 'auto-continuation':
      return { kind: 'auto-continuation' }
    case 'unknown':
      return UNKNOWN
  }
}

function hasToolResult(record: Record<string, unknown>): boolean {
  if (record.toolUseResult !== undefined) return true
  return messageContentBlocks(record).some(
    (block) => isRecordObject(block) && block.type === 'tool_result'
  )
}

/** The fallback for a record with no origin and no tool result: flags and content prefixes. */
function classifyByContent(record: Record<string, unknown>): UserRecordClass {
  const text = firstUserText(record)
  if (text?.startsWith(TASK_NOTIFICATION_PREFIX)) return classifyTaskNotification(text)
  if (text?.startsWith(RELAY_PREFIX)) return classifyPeer(originOf(record))
  if (record.isMeta === true || record.isCompactSummary === true) return { kind: 'meta' }
  if (text !== null && META_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return { kind: 'meta' }
  }
  return { kind: 'human' }
}

/**
 * Classifies one parsed transcript record by what produced it, so a reader
 * can tell a person's prompt from harness or agent input.
 *
 * Meant for lead transcripts only. Teammate transcripts receive
 * `<teammate-message` input and every subagent record is a sidechain, so
 * running it there would mislabel them.
 *
 * @remarks
 * Signals are read in order, and the first that applies wins: `turnOrigin`,
 * then `origin.kind` (a value either field holds that is not a known one
 * gives `unknown` and never falls through), then a tool result (any
 * `tool_result` block or a `toolUseResult` of any type), then the
 * `<task-notification>` prefix, then the relay prefix, then `isMeta` or
 * `isCompactSummary`, then the meta prefixes (command output and interrupt
 * markers). Prefixes are anchored at the start of the content. A `peer` from
 * either origin field, or from the relay prefix, splits on
 * `origin.handback === true`. No content is returned beyond the bounded ids
 * on `subagent-handback` and `task-notification`.
 *
 * @param record - One parsed line of a lead transcript, unvalidated.
 * @returns The record's class. A value that is not a `user` record, or is
 * malformed, gives `unknown`. It never throws.
 * @example
 * classifyUserRecord({ type: 'user', origin: { kind: 'peer', handback: true } })
 * // => { kind: 'subagent-handback' }
 */
export function classifyUserRecord(record: unknown): UserRecordClass {
  if (!isRecordObject(record) || record.type !== 'user') return UNKNOWN

  const turnOrigin = readSignal(record.turnOrigin, TURN_ORIGIN_SIGNALS)
  if (turnOrigin !== null) return fromSignal(turnOrigin, record)

  const originKind = readSignal(originOf(record)?.kind, ORIGIN_KIND_SIGNALS)
  if (originKind !== null) return fromSignal(originKind, record)

  if (hasToolResult(record)) return { kind: 'tool-result' }
  return classifyByContent(record)
}
