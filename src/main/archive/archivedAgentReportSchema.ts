import { z } from 'zod'
import { archivedSignalsSchema } from './archivedSignalsSchema'

const tokenCountsSchema = z.looseObject({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite5m: z.number(),
  cacheWrite1h: z.number()
})

const priceSchema = z.discriminatedUnion('kind', [
  z.looseObject({ kind: z.literal('priced'), usd: z.number() }),
  z.looseObject({ kind: z.literal('unpriced') }),
  z.looseObject({ kind: z.literal('free') })
])

const fileTouchSchema = z.looseObject({
  filePath: z.string(),
  operation: z.enum(['edit', 'create', 'update', 'delete', 'change'])
})

/**
 * The parts of an archived agent report the detail views read without a
 * guard: the token groups they sum and price, the files they list, the
 * activity span, and the signals. Extra fields are tolerated.
 */
export const archivedAgentReportSchema = z.looseObject({
  tokenGroups: z.array(z.looseObject({ tokens: tokenCountsSchema, price: priceSchema })),
  messageCount: z.number(),
  skippedLines: z.number(),
  fileTouches: z.array(fileTouchSchema),
  fileListIncomplete: z.boolean(),
  activity: z
    .looseObject({ earliestMs: z.number(), latestMs: z.number(), activeMs: z.number() })
    .nullable(),
  signals: archivedSignalsSchema
})
