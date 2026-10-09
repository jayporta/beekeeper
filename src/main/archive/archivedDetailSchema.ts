import { z } from 'zod'
import { sessionIdSchema } from '../../shared/ipc/requestSchemas'
import { archivedAgentReportSchema } from './archivedAgentReportSchema'
import { archivedAgentTreeSchema } from './archivedAgentTreeSchema'

/** The schema {@link ipcResultSchema} builds, typed so the checks against the DTOs see through it. */
type IpcResultSchema<Value extends z.ZodType> = z.ZodDiscriminatedUnion<
  [
    z.ZodObject<{ ok: z.ZodLiteral<true>; value: Value }, z.core.$loose>,
    z.ZodObject<{ ok: z.ZodLiteral<false> }, z.core.$loose>
  ]
>

/** An `IpcResult` whose success value `value` describes. A failure is checked for its flag only, since nothing reads what it carries. */
function ipcResultSchema<Value extends z.ZodType>(value: Value): IpcResultSchema<Value> {
  return z.discriminatedUnion('ok', [
    z.looseObject({ ok: z.literal(true), value }),
    z.looseObject({ ok: z.literal(false) })
  ])
}

const subagentReportSchema = z.looseObject({
  agentId: z.string(),
  report: ipcResultSchema(archivedAgentReportSchema)
})

const workflowRunSchema = z.looseObject({
  runId: z.string(),
  record: z
    .looseObject({
      name: z.string().nullable(),
      completed: z.boolean(),
      phases: z.array(z.string())
    })
    .nullable()
})

/**
 * The parts of an archived session detail the detail views read without a
 * guard: the lead's report, the agent tree, the subagents' reports, and the
 * workflow runs. Extra fields are tolerated.
 */
export const archivedDetailSchema = z.looseObject({
  sessionId: sessionIdSchema,
  lead: archivedAgentReportSchema,
  tree: archivedAgentTreeSchema,
  subagents: ipcResultSchema(z.array(subagentReportSchema)),
  workflowRuns: z.array(workflowRunSchema)
})
