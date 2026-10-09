import { describe, expect, it } from 'vitest'
import { errorWithCode } from '../../testErrorWithCode'
import { safeArchiveWrite } from '../safeArchiveWrite'
import { collectLog } from '../testCollectLog'

describe('safeArchiveWrite', () => {
  it('runs the write', () => {
    let ran = false

    safeArchiveWrite(() => {
      ran = true
    })

    expect(ran).toBe(true)
  })

  it('does not throw or log when the write succeeds', () => {
    const { lines, log } = collectLog()

    safeArchiveWrite(() => {}, log)

    expect(lines).toEqual([])
  })

  it('swallows a failing write and logs its code without the message', () => {
    const { lines, log } = collectLog()

    safeArchiveWrite(() => {
      throw errorWithCode('ESAFE_FIRST')
    }, log)

    expect(lines).toEqual(['Beekeeper archive write failed (ESAFE_FIRST).'])
  })

  it('logs a repeated code only once', () => {
    const { lines, log } = collectLog()
    const fail = (): void => {
      throw errorWithCode('ESAFE_REPEAT')
    }

    safeArchiveWrite(fail, log)
    safeArchiveWrite(fail, log)

    expect(lines).toHaveLength(1)
  })

  it('logs each different code', () => {
    const { lines, log } = collectLog()

    safeArchiveWrite(() => {
      throw errorWithCode('ESAFE_ONE')
    }, log)
    safeArchiveWrite(() => {
      throw errorWithCode('ESAFE_TWO')
    }, log)

    expect(lines).toHaveLength(2)
  })

  it('logs a locked database as a skipped write', () => {
    const { lines, log } = collectLog()

    safeArchiveWrite(() => {
      throw Object.assign(new Error('database is locked'), {
        code: 'ERR_SQLITE_ERROR',
        errcode: 5
      })
    }, log)

    expect(lines).toEqual(['Beekeeper archive write skipped (SQLITE_BUSY).'])
  })
})
