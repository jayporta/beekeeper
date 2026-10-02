import { describe, expect, it } from 'vitest'
import { quotaLimitsRecordSchema } from '../schemas'
import { buildAssistantRecord, buildQuotaRejectionRecord } from '../testFixtures'

const RESETS_AT = Date.parse('2026-01-08T00:00:00Z') / 1000

describe('quotaLimitsRecordSchema', () => {
  it('reads the window and reset of a rejected request, ignoring unknown fields', () => {
    const parsed = quotaLimitsRecordSchema.safeParse(buildQuotaRejectionRecord())
    expect(parsed.success && parsed.data.quotaLimits).toEqual({
      status: 'rejected',
      rateLimitType: 'seven_day',
      resetsAt: RESETS_AT,
      overageStatus: 'rejected'
    })
  })

  it('accepts the five-hour window', () => {
    const record = buildQuotaRejectionRecord({ rateLimitType: 'five_hour' })
    expect(quotaLimitsRecordSchema.safeParse(record).success).toBe(true)
  })

  it.each([
    ['a status other than rejected', { status: 'allowed_warning' }],
    ['an unknown window', { rateLimitType: 'spend_limit' }],
    ['a string reset', { resetsAt: String(RESETS_AT) }],
    ['a fractional reset', { resetsAt: RESETS_AT + 0.5 }],
    ['a negative reset', { resetsAt: -1 }],
    ['a reset before 2020', { resetsAt: 1_577_836_799 }],
    ['a reset in 2100 or later', { resetsAt: 4_102_444_800 }],
    ['an infinite reset', { resetsAt: Number.POSITIVE_INFINITY }]
  ])('rejects %s', (_name, options) => {
    expect(quotaLimitsRecordSchema.safeParse(buildQuotaRejectionRecord(options)).success).toBe(
      false
    )
  })

  it('rejects a user record carrying quotaLimits', () => {
    const record = { ...buildQuotaRejectionRecord(), type: 'user' }
    expect(quotaLimitsRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an assistant record carrying quotaLimits that is not an API error', () => {
    const record = { ...buildQuotaRejectionRecord(), isApiErrorMessage: false }
    expect(quotaLimitsRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an assistant record carrying quotaLimits with no isApiErrorMessage', () => {
    const record = Object.fromEntries(
      Object.entries(buildQuotaRejectionRecord()).filter(([key]) => key !== 'isApiErrorMessage')
    )
    expect(quotaLimitsRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects an API error with no quotaLimits', () => {
    const record = buildAssistantRecord({ extra: { isApiErrorMessage: true } })
    expect(quotaLimitsRecordSchema.safeParse(record).success).toBe(false)
  })
})
