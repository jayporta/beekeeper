import { describe, expect, it } from 'vitest'
import { buildAssistantRecord, buildQuotaRejectionRecord } from '../../testFixtures'
import { createLimitHitObserver } from '../limitHitObserver'

const seconds = (iso: string): number => Date.parse(iso) / 1000

describe('createLimitHitObserver', () => {
  it('reports no hit when no record carries one', () => {
    const observer = createLimitHitObserver()
    observer.observe(buildAssistantRecord())
    observer.observe(buildAssistantRecord({ extra: { isApiErrorMessage: true } }))
    expect(observer.latest()).toBeNull()
  })

  it('reports a hit with its reset in milliseconds', () => {
    const observer = createLimitHitObserver()
    observer.observe(
      buildQuotaRejectionRecord({
        rateLimitType: 'five_hour',
        resetsAt: seconds('2026-01-01T05:00:00Z')
      })
    )
    expect(observer.latest()).toEqual({
      window: 'fiveHour',
      resetsAtMs: Date.parse('2026-01-01T05:00:00Z')
    })
  })

  it('keeps the hit with the latest reset, whatever the line order', () => {
    const observer = createLimitHitObserver()
    observer.observe(
      buildQuotaRejectionRecord({
        rateLimitType: 'seven_day',
        resetsAt: seconds('2026-01-08T00:00:00Z')
      })
    )
    observer.observe(
      buildQuotaRejectionRecord({
        rateLimitType: 'five_hour',
        resetsAt: seconds('2026-01-02T00:00:00Z')
      })
    )
    expect(observer.latest()).toEqual({
      window: 'sevenDay',
      resetsAtMs: Date.parse('2026-01-08T00:00:00Z')
    })
  })

  it('keeps the first hit seen when two resets tie', () => {
    const observer = createLimitHitObserver()
    const resetsAt = seconds('2026-01-08T00:00:00Z')
    observer.observe(buildQuotaRejectionRecord({ rateLimitType: 'seven_day', resetsAt }))
    observer.observe(buildQuotaRejectionRecord({ rateLimitType: 'five_hour', resetsAt }))
    expect(observer.latest()?.window).toBe('sevenDay')
  })

  it('ignores an invalid hit without displacing a valid one', () => {
    const observer = createLimitHitObserver()
    observer.observe(buildQuotaRejectionRecord())
    observer.observe(buildQuotaRejectionRecord({ resetsAt: 9_999_999_999 }))
    expect(observer.latest()?.resetsAtMs).toBe(Date.parse('2026-01-08T00:00:00Z'))
  })

  it('counts a hit on a sidechain record, since the session shares one account', () => {
    const observer = createLimitHitObserver()
    observer.observe({ ...buildQuotaRejectionRecord(), isSidechain: true })
    expect(observer.latest()).not.toBeNull()
  })
})
