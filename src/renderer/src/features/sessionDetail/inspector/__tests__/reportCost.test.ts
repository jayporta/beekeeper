import { describe, expect, it } from 'vitest'
import type { PriceDto } from '../../../../../../shared/ipc/agentDto'
import { testReport, testTokenGroup } from '../../testSessionDetail'
import { reportCost } from '../reportCost'

const group = (price: PriceDto): ReturnType<typeof testTokenGroup> => ({
  ...testTokenGroup({ input: 1 }),
  price
})
const reportOf = (...prices: PriceDto[]): ReturnType<typeof testReport> =>
  testReport({ tokenGroups: prices.map(group) })

describe('reportCost', () => {
  it('sums the priced groups', () => {
    expect(reportCost(reportOf({ kind: 'priced', usd: 1.5 }, { kind: 'priced', usd: 2 }))).toEqual({
      usd: 3.5,
      partial: false
    })
  })

  it('counts a free group as nothing, without making the cost partial', () => {
    expect(reportCost(reportOf({ kind: 'priced', usd: 1 }, { kind: 'free' }))).toEqual({
      usd: 1,
      partial: false
    })
  })

  it('is partial, with the priced groups’ sum, when a group has no known price', () => {
    expect(
      reportCost(
        reportOf({ kind: 'priced', usd: 1 }, { kind: 'unpriced', reason: 'unknown-model' })
      )
    ).toEqual({ usd: 1, partial: true })
  })

  it('has no cost, and is partial, when every group is unpriced', () => {
    expect(reportCost(reportOf({ kind: 'unpriced', reason: 'unknown-speed' }))).toEqual({
      usd: null,
      partial: true
    })
  })

  it('is free when every group is free', () => {
    expect(reportCost(reportOf({ kind: 'free' }))).toEqual({ usd: 0, partial: false })
  })

  it('is nothing for an agent that used no tokens', () => {
    expect(reportCost(testReport())).toEqual({ usd: 0, partial: false })
  })
})
