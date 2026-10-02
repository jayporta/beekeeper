import { z } from 'zod'

/** 2020-01-01T00:00:00Z in epoch seconds: no real reset is earlier. */
const MIN_RESETS_AT_S = 1_577_836_800
/** 2100-01-01T00:00:00Z in epoch seconds: no real reset is this late. */
const MAX_RESETS_AT_S = 4_102_444_800

/**
 * A transcript record carrying `quotaLimits`, which Claude Code writes on an
 * assistant API-error record when a request is rejected for a plan limit. The
 * record must be an `assistant` record with `isApiErrorMessage: true`, so a
 * `quotaLimits` field on any other record is ignored. The field is
 * undocumented, so only the three fields Beekeeper reads are validated and any
 * others are kept unread. `resetsAt` is Unix epoch seconds, bounded so a
 * hostile value can't become an absurd date.
 */
export const quotaLimitsRecordSchema = z
  .object({
    type: z.literal('assistant'),
    isApiErrorMessage: z.literal(true),
    quotaLimits: z
      .object({
        status: z.literal('rejected'),
        rateLimitType: z.enum(['five_hour', 'seven_day']),
        resetsAt: z.number().int().gte(MIN_RESETS_AT_S).lt(MAX_RESETS_AT_S)
      })
      .loose()
  })
  .loose()

/** A validated record with a plan-limit rejection. */
export type QuotaLimitsRecord = z.infer<typeof quotaLimitsRecordSchema>
