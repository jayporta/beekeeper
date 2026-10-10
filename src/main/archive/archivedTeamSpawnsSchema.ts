import { z } from 'zod'

const nullableString = z.string().nullable()

/**
 * The parts of an archived `TranscriptTeamSpawns` that team grouping reads,
 * checked leniently so a field added later doesn't invalidate rows.
 */
export const archivedTeamSpawnsSchema = z.looseObject({
  spawns: z.array(
    z.looseObject({
      agentName: z.string(),
      teamName: nullableString,
      agentType: nullableString,
      rawToolUseId: nullableString
    })
  ),
  stops: z.array(z.looseObject({ agentName: z.string(), teamName: nullableString })),
  truncated: z.boolean()
})
