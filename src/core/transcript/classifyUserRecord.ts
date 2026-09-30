import { firstUserText } from './firstUserText'
import { isRecordObject } from './isRecordObject'
import { isLabelWithinCap } from './boundedLabel'
import { messageContentBlocks } from './messageContentBlocks'
import { MAX_IDENTIFIER_CODE_UNITS } from './schemas/boundedIdentifier'
import { isWithinCodeUnits } from '../shared/isWithinCodeUnits'

/**
 * What a lead transcript's `user` record is. `human` is a prompt a person
 * typed, or a record with no signal saying otherwise. The rest are input the
 * harness or another agent produced.
 */
export type UserRecordClass =
  | { kind: 'human' }
  | { kind: 'teammate-message' }
  | {
      kind: 'subagent-handback'
      /** The subagent's id, when the record names one. */
      from?: string
      /** The subagent's task id, when the record names one. */
      senderTaskId?: string
    }
  | {
      kind: 'task-notification'
      /** The `<tool-use-id>` the notification reports on, when it carries a valid one. */
      toolUseId?: string
    }
  | { kind: 'auto-continuation' }
  | { kind: 'tool-result' }
  | { kind: 'meta' }
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
const META_PREFIXES = ['<local-command-stdout>', '[Request interrupted'] as const

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

function optionalLabel(value: unknown): string | undefined {
  return isLabelWithinCap(value) ? value : undefined
}

/** Builds the hand-back or teammate-message class from the record's `origin`. */
function classifyPeer(origin: Record<string, unknown> | null): UserRecordClass {
  if (origin?.handback !== true) return { kind: 'teammate-message' }

  const from = optionalLabel(origin.from)
  const senderTaskId = optionalLabel(origin.senderTaskId)
  return {
    kind: 'subagent-handback',
    ...(from !== undefined && { from }),
    ...(senderTaskId !== undefined && { senderTaskId })
  }
}

/**
 * Reads the `<tool-use-id>` a task notification names. Only a value shaped
 * like a tool-use id and within the identifier cap is returned, so no other
 * notification content is ever kept.
 */
function classifyTaskNotification(text: string | null): UserRecordClass {
  const candidate = text === null ? undefined : TOOL_USE_ID_TAG.exec(text)?.[1]
  if (
    candidate === undefined ||
    !isWithinCodeUnits(candidate, MAX_IDENTIFIER_CODE_UNITS) ||
    !TOOL_USE_ID_SHAPE.test(candidate)
  ) {
    return { kind: 'task-notification' }
  }
  return { kind: 'task-notification', toolUseId: candidate }
}

function fromSignal(
  signal: OriginSignal,
  origin: Record<string, unknown> | null,
  text: string | null
): UserRecordClass {
  switch (signal) {
    case 'human':
      return { kind: 'human' }
    case 'peer':
      return classifyPeer(origin)
    case 'task-notification':
      return classifyTaskNotification(text)
    case 'auto-continuation':
      return { kind: 'auto-continuation' }
  }
}

function hasToolResult(record: Record<string, unknown>): boolean {
  if (record.toolUseResult !== undefined) return true
  return messageContentBlocks(record).some(
    (block) => isRecordObject(block) && block.type === 'tool_result'
  )
}

function classifyByPrefix(
  text: string | null,
  origin: Record<string, unknown> | null
): UserRecordClass {
  if (text === null) return { kind: 'human' }
  if (text.startsWith(TASK_NOTIFICATION_PREFIX)) return classifyTaskNotification(text)
  if (text.startsWith(RELAY_PREFIX)) return classifyPeer(origin)
  if (META_PREFIXES.some((prefix) => text.startsWith(prefix))) return { kind: 'meta' }
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
 * `tool_result` block or a `toolUseResult` of any type), then `isMeta` or
 * `isCompactSummary`, then anchored content prefixes. A `peer` from either
 * origin field splits on `origin.handback === true`. Content prefixes are a
 * fallback for records without an origin, and no content is returned beyond
 * the bounded ids on `subagent-handback` and `task-notification`.
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

  const origin = isRecordObject(record.origin) ? record.origin : null
  const text = firstUserText(record)

  const turnOrigin = readSignal(record.turnOrigin, TURN_ORIGIN_SIGNALS)
  if (turnOrigin !== null)
    return turnOrigin === 'unknown' ? UNKNOWN : fromSignal(turnOrigin, origin, text)

  const originKind = readSignal(origin?.kind, ORIGIN_KIND_SIGNALS)
  if (originKind !== null)
    return originKind === 'unknown' ? UNKNOWN : fromSignal(originKind, origin, text)

  if (hasToolResult(record)) return { kind: 'tool-result' }
  if (record.isMeta === true || record.isCompactSummary === true) return { kind: 'meta' }
  return classifyByPrefix(text, origin)
}
