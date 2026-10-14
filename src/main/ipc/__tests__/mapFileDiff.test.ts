import { describe, expect, it } from 'vitest'
import type { FileChange } from '../../../core/session/fileDiff/fileChange'
import type { FileTouch } from '../../../core/session/fileTouchCollector'
import { mapFileDiff } from '../mapFileDiff'

const touch = (toolUseId: string, source: FileTouch['source'] = 'edit-write'): FileTouch => ({
  filePath: '/a.ts',
  operation: 'edit',
  source,
  toolUseId
})

const map = (
  touches: FileTouch[],
  entries: [string, FileChange][],
  truncated: boolean
): ReturnType<typeof mapFileDiff> =>
  mapFileDiff({
    filePath: '/a.ts',
    touches,
    changes: { byToolUseId: new Map(entries), truncated }
  })

describe('mapFileDiff', () => {
  it('reads a touch with no result as unrecorded when the read finished', () => {
    expect(map([touch('t1')], [], false).changes).toEqual([
      { kind: 'unrecorded', source: 'edit-write', operation: 'edit' }
    ])
  })

  it('reads a touch the read never reached as a cut change when it stopped at the cap', () => {
    expect(map([touch('t1', 'bash')], [], true).changes).toEqual([
      {
        kind: 'patch',
        source: 'bash',
        operation: 'edit',
        hunks: [],
        userModified: false,
        shared: false,
        cut: true
      }
    ])
  })

  it('keeps the cut flag of a change that was read', () => {
    const change: FileChange = {
      kind: 'patch',
      hunks: [],
      userModified: true,
      shared: false,
      cut: true
    }

    expect(map([touch('t1')], [['t1', change]], true).changes).toMatchObject([
      { kind: 'patch', userModified: true, cut: true }
    ])
  })
})
