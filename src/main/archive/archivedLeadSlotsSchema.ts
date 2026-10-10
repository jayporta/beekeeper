import { z } from 'zod'

/**
 * The parts of archived lead slots that usage over time reads, checked
 * leniently so a field added later doesn't invalidate rows. A transcript with
 * no usage stores empty slots. JSON `null` is stored when the scan held more
 * messages than it keeps.
 */
export const archivedLeadSlotsSchema = z
  .looseObject({
    slots: z.array(z.looseObject({ slot: z.number(), model: z.string(), tokens: z.number() })),
    undatedMessages: z.number(),
    invalidAssistantRecords: z.number()
  })
  .nullable()
