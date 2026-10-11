import { describe, expect, it } from 'vitest'
import { mapReconciliation } from '../mapReconciliation'

describe('mapReconciliation', () => {
  it('drops a field a core reconciliation gains later', () => {
    const core = {
      models: [
        {
          model: 'm',
          extraRow: 'leak',
          transcript: {
            input: 1,
            output: 2,
            cacheRead: 3,
            cacheWrite: 4,
            usd: 5,
            partial: false,
            extraT: 'leak'
          },
          recorded: {
            input: 1,
            output: 2,
            cacheRead: 3,
            cacheWrite: 4,
            costUSD: 5,
            partial: false,
            extraR: 'leak'
          }
        }
      ],
      totals: { transcriptUSD: 1, transcriptPartial: false, recordedUSD: 2, extraTotal: 'leak' },
      extraTop: 'leak'
    }
    const dto = mapReconciliation(core as unknown as Parameters<typeof mapReconciliation>[0])
    expect(JSON.stringify(dto)).not.toContain('leak')
    expect(dto.models[0]?.transcript?.usd).toBe(5)
    expect(dto.totals.recordedUSD).toBe(2)
  })
})
