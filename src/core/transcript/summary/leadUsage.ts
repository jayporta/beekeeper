/** The tokens one model used in one 15-minute UTC slot. */
export interface LeadUsageSlot {
  /** `Math.floor(epochMs / QUARTER_HOUR_MS)` of the message's earliest record. */
  readonly slot: number
  /** The normalized model id. */
  readonly model: string
  /** The total tokens across every billing class. */
  readonly tokens: number
}

/** A transcript's own assistant usage, for usage over time. */
export interface LeadUsage {
  /** Sorted by slot, then model. One entry per (slot, model) with tokens above zero. */
  readonly slots: readonly LeadUsageSlot[]
  /** Counted messages with no timestamp, left out of every slot. */
  readonly undatedMessages: number
  /** `assistant` records that failed schema validation. */
  readonly invalidAssistantRecords: number
  /** Every valid assistant message id the transcript reported, counted or not. */
  readonly messageIds: ReadonlySet<string>
}
