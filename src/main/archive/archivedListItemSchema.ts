import { z } from 'zod'
import { projectDirNameSchema, sessionIdSchema } from '../../shared/ipc/requestSchemas'

const nullableNumber = z.number().nullable()
const nullableString = z.string().nullable()

const roleSchema = z.discriminatedUnion('kind', [
  z.looseObject({ kind: z.literal('lead') }),
  z.looseObject({
    kind: z.literal('agent'),
    agentType: nullableString,
    agentName: nullableString,
    teamName: nullableString
  })
])

/** What the list views read of a summary: a card's label, notes and usage. */
const summaryValueSchema = z.looseObject({
  title: nullableString,
  usage: z.looseObject({ totalUSD: nullableNumber, totalTokens: nullableNumber }).nullable(),
  activity: z.looseObject({ earliestMs: z.number(), latestMs: z.number() }).nullable(),
  skippedLines: z.number(),
  role: roleSchema,
  model: nullableString,
  limitHit: z
    .looseObject({ window: z.enum(['fiveHour', 'sevenDay']), resetsAtMs: z.number() })
    .nullable(),
  transcriptTokens: nullableNumber
})

const agentTermSchema = z.looseObject({
  name: nullableString,
  description: nullableString,
  agentType: z.string()
})

/**
 * The parts of an archived list item the list views read without a guard,
 * checked leniently so a field added later doesn't invalidate rows. An
 * archived item always has a readable summary, since only those are written.
 */
export const archivedListItemSchema = z.looseObject({
  projectDirName: projectDirNameSchema,
  sessionId: sessionIdSchema,
  modifiedMs: nullableNumber,
  agentTerms: z.array(agentTermSchema),
  workflowRunNames: z.array(z.string()),
  summary: z.looseObject({ ok: z.literal(true), value: summaryValueSchema })
})
