import type {
  UsageReconciliation,
  ModelReconciliation,
  ReconciledTokens
} from '../../core/session/reconcileUsage'
import type {
  ModelReconciliationDto,
  ReconciledTokensDto,
  ReconciliationDto
} from '../../shared/ipc/reconciliationDto'

function mapTokens(tokens: ReconciledTokens): ReconciledTokensDto {
  return {
    input: tokens.input,
    output: tokens.output,
    cacheRead: tokens.cacheRead,
    cacheWrite: tokens.cacheWrite
  }
}

function mapModel(row: ModelReconciliation): ModelReconciliationDto {
  return {
    model: row.model,
    transcript:
      row.transcript === null
        ? null
        : {
            ...mapTokens(row.transcript),
            usd: row.transcript.usd,
            partial: row.transcript.partial
          },
    recorded:
      row.recorded === null
        ? null
        : {
            ...mapTokens(row.recorded),
            costUSD: row.recorded.costUSD,
            partial: row.recorded.partial
          }
  }
}

/**
 * Maps a core usage reconciliation onto its transfer shape, copying each
 * field by name so a field added to the core type never crosses the bridge.
 *
 * @param reconciliation - The core reconciliation.
 * @returns The reconciliation DTO.
 */
export function mapReconciliation(reconciliation: UsageReconciliation): ReconciliationDto {
  const { totals } = reconciliation
  return {
    models: reconciliation.models.map(mapModel),
    totals: {
      transcriptUSD: totals.transcriptUSD,
      transcriptPartial: totals.transcriptPartial,
      recordedUSD: totals.recordedUSD
    }
  }
}
