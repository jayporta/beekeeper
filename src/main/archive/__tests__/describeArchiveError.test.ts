import { describe, expect, it } from 'vitest'
import { errorWithCode } from '../../testErrorWithCode'
import { describeArchiveError } from '../describeArchiveError'

function sqliteError(errcode: number): Error {
  return Object.assign(new Error('database is locked (/Users/someone/archive.sqlite)'), {
    code: 'ERR_SQLITE_ERROR',
    errcode
  })
}

describe('describeArchiveError', () => {
  it('names a locked database SQLITE_BUSY', () => {
    expect(describeArchiveError(sqliteError(5))).toBe('SQLITE_BUSY')
  })

  it('names an extended busy result code SQLITE_BUSY', () => {
    expect(describeArchiveError(sqliteError(5 | (1 << 8)))).toBe('SQLITE_BUSY')
  })

  it('names any other SQLite failure by its code and primary result code', () => {
    expect(describeArchiveError(sqliteError(13))).toBe('ERR_SQLITE_ERROR (result 13)')
  })

  it('names a failure without a result code the way a log line names an error', () => {
    expect(describeArchiveError(errorWithCode('EACCES'))).toBe('EACCES')
  })

  it('never includes the message', () => {
    expect(describeArchiveError(sqliteError(13))).not.toContain('/Users')
  })
})
