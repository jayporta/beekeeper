import { describe, expect, it } from 'vitest'
import { testReport, testTokenGroup } from '../../testSessionDetail'
import { inspectorReasons } from '../inspectorReasons'

const complete = { usd: 1, partial: false }
const noBelow = { tokens: 0, below: 0, incomplete: false, subagentsNotLoaded: false }

describe('inspectorReasons', () => {
  it('is empty for a complete report', () => {
    expect(
      inspectorReasons({
        report: testReport(),
        cost: complete,
        rollup: noBelow,
        partial: false,
        subagentsUnreadable: false
      }).size
    ).toBe(0)
  })

  it('names unreadable transcript lines', () => {
    const reasons = inspectorReasons({
      report: testReport({ skippedLines: 2 }),
      cost: complete,
      rollup: noBelow,
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['unreadableLines'])
  })

  it('names tokens with no known price', () => {
    const reasons = inspectorReasons({
      report: testReport(),
      cost: { usd: null, partial: true },
      rollup: noBelow,
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['unpricedTokens'])
  })

  it('names a file list that may be missing files', () => {
    const reasons = inspectorReasons({
      report: testReport({ fileListIncomplete: true }),
      cost: complete,
      rollup: noBelow,
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['incompleteFiles'])
  })

  it('names agents below whose totals are partial', () => {
    const reasons = inspectorReasons({
      report: testReport(),
      cost: complete,
      rollup: { ...noBelow, incomplete: true },
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['belowIncomplete'])
  })

  it('names teammates whose subagents are not loaded', () => {
    const reasons = inspectorReasons({
      report: testReport({ tokenGroups: [testTokenGroup({ input: 1 })] }),
      cost: complete,
      rollup: { tokens: 10, below: 1, incomplete: false, subagentsNotLoaded: true },
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['subagentsNotLoaded'])
  })

  it('names unrecorded own tokens when agents below are added to them', () => {
    const reasons = inspectorReasons({
      report: testReport({ tokenGroups: [] }),
      cost: complete,
      rollup: { tokens: 10, below: 1, incomplete: false, subagentsNotLoaded: false },
      partial: false,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['unrecordedTokens'])
  })

  it('leaves out unrecorded own tokens when there are no agents below to mark', () => {
    const reasons = inspectorReasons({
      report: testReport({ tokenGroups: [] }),
      cost: complete,
      rollup: noBelow,
      partial: false,
      subagentsUnreadable: false
    })

    expect(reasons.size).toBe(0)
  })

  it('names an unreadable subagents folder, whatever else applies', () => {
    const reasons = inspectorReasons({
      report: testReport({ skippedLines: 1 }),
      cost: complete,
      rollup: noBelow,
      partial: true,
      subagentsUnreadable: true
    })

    expect([...reasons]).toEqual(['unreadableLines', 'subagentsUnreadable'])
  })

  it('names the other reason when the node is partial and no figure says why', () => {
    const reasons = inspectorReasons({
      report: testReport(),
      cost: complete,
      rollup: noBelow,
      partial: true,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['other'])
  })

  it('leaves out the other reason when a figure already says why', () => {
    const reasons = inspectorReasons({
      report: testReport({ skippedLines: 1 }),
      cost: complete,
      rollup: noBelow,
      partial: true,
      subagentsUnreadable: false
    })

    expect([...reasons]).toEqual(['unreadableLines'])
  })

  it('names every reason that applies', () => {
    const reasons = inspectorReasons({
      report: testReport({ skippedLines: 1, fileListIncomplete: true }),
      cost: { usd: 1, partial: true },
      rollup: { ...noBelow, incomplete: true },
      partial: false,
      subagentsUnreadable: false
    })

    expect(reasons.size).toBe(4)
  })
})
