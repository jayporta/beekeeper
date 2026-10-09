import { describe, expect, it } from 'vitest'
import { errorWithCode } from '../../testErrorWithCode'
import { safeArchiveRead } from '../safeArchiveRead'

function collectLog(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = []
  return { lines, log: (line) => lines.push(line) }
}

describe('safeArchiveRead', () => {
  it('returns what the read returns and logs nothing', () => {
    const { lines, log } = collectLog()

    expect(safeArchiveRead(() => 'value', 'fallback', log)).toBe('value')
    expect(lines).toEqual([])
  })

  it('returns the fallback when the read throws, logging only its code', () => {
    const { lines, log } = collectLog()

    const result = safeArchiveRead(
      () => {
        throw errorWithCode('EREAD_FIRST')
      },
      'fallback',
      log
    )

    expect(result).toBe('fallback')
    expect(lines).toEqual(['Beekeeper archive read failed (EREAD_FIRST).'])
  })

  it('logs a repeated failure once', () => {
    const { lines, log } = collectLog()
    const fail = (): string => {
      throw errorWithCode('EREAD_REPEAT')
    }

    safeArchiveRead(fail, 'x', log)
    safeArchiveRead(fail, 'x', log)

    expect(lines).toHaveLength(1)
  })

  it('logs each different failure', () => {
    const { lines, log } = collectLog()

    safeArchiveRead(
      () => {
        throw errorWithCode('EREAD_ONE')
      },
      0,
      log
    )
    safeArchiveRead(
      () => {
        throw errorWithCode('EREAD_TWO')
      },
      0,
      log
    )

    expect(lines).toHaveLength(2)
  })
})
