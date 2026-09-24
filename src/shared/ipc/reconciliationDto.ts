/** Token totals for one model on one side of a reconciliation. */
export interface ReconciledTokensDto {
  /** Input tokens. */
  readonly input: number
  /** Output tokens. */
  readonly output: number
  /** Tokens read from the prompt cache. */
  readonly cacheRead: number
  /** Tokens written to the prompt cache. */
  readonly cacheWrite: number
}

/** What the agents' transcripts add up to for one model. */
export interface TranscriptModelUsageDto extends ReconciledTokensDto {
  /** USD of the priced groups, or `null` when none was priced. */
  readonly usd: number | null
  /** Whether some group had no known price, so `usd` is a lower bound. */
  readonly partial: boolean
}

/** What the lead's recorded cost state holds for one model. */
export interface RecordedModelUsageDto extends ReconciledTokensDto {
  /** The recorded cost in USD, or `null` when none was recorded. */
  readonly costUSD: number | null
  /** Whether `costUSD` is a lower bound. */
  readonly partial: boolean
}

/** One model's usage from each side. A side with none is `null`. */
export interface ModelReconciliationDto {
  /** The normalized model id. */
  readonly model: string
  /** Usage summed from the transcripts. */
  readonly transcript: TranscriptModelUsageDto | null
  /** Usage from the recorded cost state. */
  readonly recorded: RecordedModelUsageDto | null
}

/** A session's usage from its transcripts beside what it recorded. */
export interface ReconciliationDto {
  /** One row per model, sorted by model id. */
  readonly models: readonly ModelReconciliationDto[]
  /** The session's total cost from each side. */
  readonly totals: {
    /** USD summed from priced transcript groups, or `null`. */
    readonly transcriptUSD: number | null
    /** Whether the transcript figures are a lower bound. */
    readonly transcriptPartial: boolean
    /** The recorded total in USD, or `null`. */
    readonly recordedUSD: number | null
  }
}
