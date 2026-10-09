import { describe, expect, it } from 'vitest'
import { parseArchivedDetail, parseArchivedListItem } from '../parseArchivedRow'
import { testPopulatedDetail, testPopulatedListItem, TEST_REF } from '../testArchiveFixtures'

/** A property to damage in a row, and a value of the wrong type to put there. */
type Damage = readonly [path: string, wrong: unknown]

function isContainer(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Serializes `row` with the property at a dotted path replaced, or removed
 * when the replacement is `undefined`.
 *
 * @throws {Error} When an object above the property is missing, so a mistyped path can't pass as a rejection.
 */
function withValueAt(row: unknown, path: string, replacement: unknown): string {
  const copy: unknown = JSON.parse(JSON.stringify(row))
  const keys = path.split('.')
  const last = keys.pop()
  let node = copy
  for (const key of keys) node = isContainer(node) ? node[key] : undefined
  if (last === undefined || !isContainer(node)) throw new Error(`no object above ${path}`)
  node[last] = replacement
  return JSON.stringify(copy)
}

const INVALID_SHAPE = { ok: false, error: 'invalid-shape' }

/** A populated list item as the archive holds it. */
const ITEM = { ...testPopulatedListItem(), team: null }

/** Every property of a list item the list views read without a guard, each with a wrong value. */
const ITEM_PROPERTIES: readonly Damage[] = [
  ['agentTerms', {}],
  ['agentTerms.0', null],
  ['agentTerms.0.name', 7],
  ['agentTerms.0.description', 7],
  ['agentTerms.0.agentType', null],
  ['workflowRunNames', 'nightly'],
  ['summary.value.usage', 'cheap'],
  ['summary.value.usage.totalUSD', '1.5'],
  ['summary.value.usage.totalTokens', '1200'],
  ['summary.value.activity.latestMs', 'late'],
  ['summary.value.skippedLines', '2'],
  ['summary.value.role', { kind: 'robot' }],
  ['summary.value.role.agentType', 7],
  ['summary.value.role.agentName', 7],
  ['summary.value.role.teamName', 7],
  ['summary.value.model', 7],
  ['summary.value.limitHit', {}],
  ['summary.value.limitHit.window', 'daily'],
  ['summary.value.limitHit.resetsAtMs', 'soon'],
  ['summary.value.transcriptTokens', '1000']
]

/** The agent report's properties every detail view reads, as paths below a report. */
const REPORT_PROPERTIES: readonly Damage[] = [
  ['tokenGroups', {}],
  ['tokenGroups.0', null],
  ['tokenGroups.0.tokens', {}],
  ['tokenGroups.0.tokens.input', 'x'],
  ['tokenGroups.0.tokens.output', 'x'],
  ['tokenGroups.0.tokens.cacheRead', 'x'],
  ['tokenGroups.0.tokens.cacheWrite5m', 'x'],
  ['tokenGroups.0.tokens.cacheWrite1h', 'x'],
  ['tokenGroups.0.price', {}],
  ['tokenGroups.0.price.kind', 'paid'],
  ['tokenGroups.0.price.usd', 'x'],
  ['messageCount', 'x'],
  ['skippedLines', 'x'],
  ['fileTouches', {}],
  ['fileTouches.0', null],
  ['fileTouches.0.filePath', 7],
  ['fileTouches.0.operation', 'rename'],
  ['fileListIncomplete', 'yes'],
  ['activity', {}],
  ['activity.earliestMs', 'x'],
  ['activity.latestMs', 'x'],
  ['activity.activeMs', 'x'],
  ['signals', {}],
  ['signals.toolErrors', 'x'],
  ['signals.longestErrorStreak', 'x'],
  ['signals.longestBashRepeat', 'x'],
  ['signals.compactions', 'x'],
  ['signals.agentsKilled', 'x'],
  ['signals.longestToolWait', {}],
  ['signals.longestToolWait.ms', 'x'],
  ['signals.longestToolWait.tool', 7],
  ['signals.partial', 'yes']
]

/** Every property of a detail the detail views read without a guard, each with a wrong value. */
const DETAIL_PROPERTIES: readonly Damage[] = [
  ['lead', {}],
  ...REPORT_PROPERTIES.map(([path, wrong]): Damage => [`lead.${path}`, wrong]),
  ['tree', {}],
  ['tree.agentId', 7],
  ['tree.workflowRunId', 7],
  ['tree.meta', {}],
  ['tree.meta.status', 'lost'],
  ['tree.children', {}],
  ['tree.children.0', null],
  ['tree.children.0.meta.meta', {}],
  ['tree.children.0.meta.meta.agentType', 7],
  ['tree.children.0.children', 'x'],
  ['tree.children.0.children.0', {}],
  ['tree.children.0.children.0.agentId', 7],
  ['subagents', {}],
  ['subagents.value', {}],
  ['subagents.value.0', null],
  ['subagents.value.0.agentId', 7],
  ['subagents.value.0.report', {}],
  ['subagents.value.0.report.value', {}],
  ...REPORT_PROPERTIES.map(([path, wrong]): Damage => [
    `subagents.value.0.report.value.${path}`,
    wrong
  ]),
  ['workflowRuns', {}],
  ['workflowRuns.0', null],
  ['workflowRuns.0.runId', 7],
  ['workflowRuns.0.record', 'nightly'],
  ['workflowRuns.0.record.name', 7],
  ['workflowRuns.0.record.completed', 'yes'],
  ['workflowRuns.0.record.phases', 'plan'],
  ['workflowRuns.0.record.phases.0', 7]
]

/** Optional properties of an agent's meta the detail views read as text, a number, or a flag. */
const META_PROPERTIES: readonly Damage[] = [
  ['description', 7],
  ['model', 7],
  ['name', 7],
  ['teamName', 7],
  ['worktreeBranch', 7],
  ['spawnDepth', '0'],
  ['stoppedByUser', 'yes']
]

describe('parseArchivedListItem on a hand-edited row', () => {
  it('accepts a populated item', () => {
    expect(parseArchivedListItem(JSON.stringify(ITEM), TEST_REF).ok).toBe(true)
  })

  it.each(ITEM_PROPERTIES)('rejects an item whose %s is %j', (path, wrong) => {
    expect(parseArchivedListItem(withValueAt(ITEM, path, wrong), TEST_REF)).toEqual(INVALID_SHAPE)
  })

  it.each(ITEM_PROPERTIES.map(([path]) => [path]))('rejects an item with no %s', (path) => {
    expect(parseArchivedListItem(withValueAt(ITEM, path, undefined), TEST_REF)).toEqual(
      INVALID_SHAPE
    )
  })
})

describe('parseArchivedDetail on a hand-edited row', () => {
  const detail = testPopulatedDetail()

  it('accepts a populated detail', () => {
    expect(parseArchivedDetail(JSON.stringify(detail), TEST_REF).ok).toBe(true)
  })

  it.each(DETAIL_PROPERTIES)('rejects a detail whose %s is %j', (path, wrong) => {
    expect(parseArchivedDetail(withValueAt(detail, path, wrong), TEST_REF)).toEqual(INVALID_SHAPE)
  })

  it.each(DETAIL_PROPERTIES.map(([path]) => [path]))('rejects a detail with no %s', (path) => {
    expect(parseArchivedDetail(withValueAt(detail, path, undefined), TEST_REF)).toEqual(
      INVALID_SHAPE
    )
  })

  it.each(META_PROPERTIES)('rejects a detail whose child agent meta %s is %j', (name, wrong) => {
    const path = `tree.children.0.meta.meta.${name}`

    expect(parseArchivedDetail(withValueAt(detail, path, wrong), TEST_REF)).toEqual(INVALID_SHAPE)
  })
})
