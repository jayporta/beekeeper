import { describe, expect, it } from 'vitest'
import { errorWithCode } from '../../testErrorWithCode'
import { guardArchiveCall } from '../guardArchiveCall'
import { collectLog } from '../testCollectLog'

function failing(code: string): () => number {
  return () => {
    throw errorWithCode(code)
  }
}

const locked = (): number => {
  throw Object.assign(new Error('database is locked'), { code: 'ERR_SQLITE_ERROR', errcode: 5 })
}

describe('guardArchiveCall', () => {
  it('returns what the call returns and logs nothing', () => {
    const { lines, log } = collectLog()

    expect(guardArchiveCall({ run: () => 7, fallback: 0, kind: 'read', log })).toBe(7)
    expect(lines).toEqual([])
  })

  it('returns the fallback when the call throws, logging the kind and the code', () => {
    const { lines, log } = collectLog()

    const result = guardArchiveCall({ run: failing('EGUARD_ONE'), fallback: -1, kind: 'read', log })

    expect(result).toBe(-1)
    expect(lines).toEqual(['Beekeeper archive read failed (EGUARD_ONE).'])
  })

  it('logs a repeated failure of one kind once', () => {
    const { lines, log } = collectLog()

    guardArchiveCall({ run: failing('EGUARD_TWO'), fallback: 0, kind: 'write', log })
    guardArchiveCall({ run: failing('EGUARD_TWO'), fallback: 0, kind: 'write', log })

    expect(lines).toHaveLength(1)
  })

  it('logs each different code', () => {
    const { lines, log } = collectLog()

    guardArchiveCall({ run: failing('EGUARD_FOUR'), fallback: 0, kind: 'read', log })
    guardArchiveCall({ run: failing('EGUARD_FIVE'), fallback: 0, kind: 'read', log })

    expect(lines).toHaveLength(2)
  })

  it('logs the same code again for the other kind of call', () => {
    const { lines, log } = collectLog()

    guardArchiveCall({ run: failing('EGUARD_THREE'), fallback: 0, kind: 'write', log })
    guardArchiveCall({ run: failing('EGUARD_THREE'), fallback: 0, kind: 'read', log })

    expect(lines).toEqual([
      'Beekeeper archive write failed (EGUARD_THREE).',
      'Beekeeper archive read failed (EGUARD_THREE).'
    ])
  })

  it('logs a locked database as a skipped write', () => {
    const { lines, log } = collectLog()

    guardArchiveCall({ run: locked, fallback: 0, kind: 'write', log })

    expect(lines).toEqual(['Beekeeper archive write skipped (SQLITE_BUSY).'])
  })

  it('logs a locked database as a failed read', () => {
    const { lines, log } = collectLog()

    guardArchiveCall({ run: locked, fallback: 0, kind: 'read', log })

    expect(lines).toEqual(['Beekeeper archive read failed (SQLITE_BUSY).'])
  })
})
