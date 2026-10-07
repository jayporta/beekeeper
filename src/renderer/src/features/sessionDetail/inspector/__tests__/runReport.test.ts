import { describe, expect, it } from 'vitest'
import { testDetail, testNode, testReport, testTokenGroup } from '../../testSessionDetail'
import { readableReports, runReport, runTokensPartial } from '../runReport'

type Reports = NonNullable<NonNullable<Parameters<typeof testDetail>[0]>['reports']>

/** A detail whose lead holds the run's agents `w1` and `w2` and a plain subagent `a1`. */
const detailOf = (reports: Exclude<Reports, false>): ReturnType<typeof testDetail> =>
  testDetail({ children: [testNode('w1'), testNode('w2'), testNode('a1')], reports })

/** The run report of the given agents, read the way the inspector reads it. */
const reportOf = (
  detail: ReturnType<typeof testDetail>,
  ids: readonly string[]
): ReturnType<typeof runReport> => runReport(readableReports(detail, ids))

/** Whether the run's tokens may be low, read the way the inspector reads it. */
const partialOf = (detail: ReturnType<typeof testDetail>, ids: readonly string[]): boolean =>
  runTokensPartial(readableReports(detail, ids), ids.length)

describe('readableReports', () => {
  it('lists the reports of the given agents in the order given', () => {
    const detail = detailOf({
      w1: testReport({ messageCount: 1 }),
      w2: testReport({ messageCount: 2 })
    })

    expect(readableReports(detail, ['w2', 'w1']).map(({ messageCount }) => messageCount)).toEqual([
      2, 1
    ])
  })

  it('has none when the subagents folder could not be read', () => {
    expect(readableReports(testDetail({ reports: false }), ['w1'])).toEqual([])
  })
})

describe('runReport', () => {
  it('holds the token groups of every agent', () => {
    const detail = detailOf({
      w1: testReport({ tokenGroups: [testTokenGroup({ input: 1 }, 'm1')] }),
      w2: testReport({ tokenGroups: [testTokenGroup({ output: 2 }, 'm2')] })
    })

    const report = reportOf(detail, ['w1', 'w2'])

    expect(report.tokenGroups.map(({ model }) => model)).toEqual(['m1', 'm2'])
  })

  it('sums the message counts and the skipped lines', () => {
    const detail = detailOf({
      w1: testReport({ messageCount: 3, skippedLines: 1 }),
      w2: testReport({ messageCount: 4, skippedLines: 2 })
    })

    expect(reportOf(detail, ['w1', 'w2'])).toMatchObject({ messageCount: 7, skippedLines: 3 })
  })

  it('spans from the earliest start to the latest end', () => {
    const detail = detailOf({
      w1: testReport({ activity: { earliestMs: 100, latestMs: 200 } }),
      w2: testReport({ activity: { earliestMs: 50, latestMs: 150 } })
    })

    expect(reportOf(detail, ['w1', 'w2']).activity).toEqual({ earliestMs: 50, latestMs: 200 })
  })

  it('ignores an agent with no activity span when working out the span', () => {
    const detail = detailOf({ w1: testReport({ activity: { earliestMs: 100, latestMs: 200 } }) })

    expect(reportOf(detail, ['w1', 'w2']).activity).toEqual({ earliestMs: 100, latestMs: 200 })
  })

  it('has no span when no agent has one', () => {
    expect(reportOf(detailOf({}), ['w1', 'w2']).activity).toBeNull()
  })

  it('skips an agent whose report is unreadable', () => {
    const detail = detailOf({
      w1: testReport({ messageCount: 3 }),
      w2: 'error'
    })

    expect(reportOf(detail, ['w1', 'w2']).messageCount).toBe(3)
  })

  it('skips an agent the detail does not hold', () => {
    const detail = detailOf({ w1: testReport({ messageCount: 3 }) })

    expect(reportOf(detail, ['w1', 'gone']).messageCount).toBe(3)
  })

  it('shows no files, whatever its agents touched', () => {
    const touch = { filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write' } as const
    const detail = detailOf({
      w1: testReport({ fileTouches: [touch], fileListIncomplete: true })
    })

    expect(reportOf(detail, ['w1'])).toMatchObject({
      fileTouches: [],
      fileListIncomplete: false
    })
  })

  it('has no groups and no span for no agents', () => {
    expect(reportOf(detailOf({}), [])).toMatchObject({
      tokenGroups: [],
      messageCount: 0,
      activity: null
    })
  })
})

describe('runTokensPartial', () => {
  const spent = testReport({ tokenGroups: [testTokenGroup({ output: 5 })] })

  it('is false when every agent has readable tokens', () => {
    expect(partialOf(detailOf({ w1: spent, w2: spent }), ['w1', 'w2'])).toBe(false)
  })

  it('is true when an agent’s report is unreadable', () => {
    expect(partialOf(detailOf({ w1: spent, w2: 'error' }), ['w1', 'w2'])).toBe(true)
  })

  it('is true when the detail does not hold an agent', () => {
    expect(partialOf(detailOf({ w1: spent }), ['w1', 'gone'])).toBe(true)
  })

  it('is true when an agent skipped transcript lines', () => {
    const skipped = { ...spent, skippedLines: 1 }

    expect(partialOf(detailOf({ w1: spent, w2: skipped }), ['w1', 'w2'])).toBe(true)
  })

  it('is true when an agent recorded no tokens', () => {
    expect(partialOf(detailOf({ w1: spent, w2: testReport() }), ['w1', 'w2'])).toBe(true)
  })

  it('is false for an incomplete file list alone, since a run shows no files', () => {
    const files = { ...spent, fileListIncomplete: true }

    expect(partialOf(detailOf({ w1: files }), ['w1'])).toBe(false)
  })
})
