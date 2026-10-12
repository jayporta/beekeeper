import { describe, expect, it } from 'vitest'
import { mapSessionRef } from '../mapSessionRef'

describe('mapSessionRef', () => {
  it('copies only the folder name and the session id', () => {
    const ref = { projectDirName: '-p', sessionId: 's1', label: 'not for the bridge' }

    expect(mapSessionRef(ref)).toEqual({ projectDirName: '-p', sessionId: 's1' })
  })
})
