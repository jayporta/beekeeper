import { z } from 'zod'

/**
 * The parts of archived lead slots that usage over time reads, checked
 * leniently so a field added later doesn't invalidate rows. A transcript with
 * no lead usage is stored as JSON `null`.
 */
export const archivedLeadSlotsSchema = z
  .looseObject({
    slots: z.array(z.looseObject({ slot: z.number(), model: z.string(), tokens: z.number() })),
    undatedMessages: z.number(),
    invalidAssistantRecords: z.number()
  })
  .nullable()
