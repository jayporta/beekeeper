import { describe, expect, it } from 'vitest'
import type { FileTouchDto } from '../../../../../../shared/ipc/agentDto'
import { groupFileTouches } from '../groupFileTouches'

const touch = (filePath: string, operation: FileTouchDto['operation']): FileTouchDto => ({
  filePath,
  operation,
  source: 'edit-write'
})

describe('groupFileTouches', () => {
  it('has no groups for no touches', () => {
    expect(groupFileTouches([])).toEqual([])
  })

  it('folds every touch of a path into one group, with its distinct operations in the order seen', () => {
    const groups = groupFileTouches([
      touch('/a', 'create'),
      touch('/a', 'edit'),
      touch('/a', 'delete')
    ])

    expect(groups).toEqual([
      { filePath: '/a', operations: ['create', 'edit', 'delete'], touches: 3 }
    ])
  })

  it('lists the paths in the order each was first seen', () => {
    const groups = groupFileTouches([touch('/b', 'edit'), touch('/a', 'edit'), touch('/b', 'edit')])

    expect(groups.map((group) => group.filePath)).toEqual(['/b', '/a'])
  })

  it('names a repeated operation once, while still counting each touch', () => {
    const groups = groupFileTouches([touch('/a', 'edit'), touch('/a', 'edit')])

    expect(groups).toEqual([{ filePath: '/a', operations: ['edit'], touches: 2 }])
  })
})
