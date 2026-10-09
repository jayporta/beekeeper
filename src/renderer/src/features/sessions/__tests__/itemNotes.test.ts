import { describe, expect, it } from 'vitest'
import { archivedNote, folderNote, stoppedNote } from '../itemNotes'
import { testRef, testSession, testTeammateTeam } from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

describe('stoppedNote', () => {
  it('notes a teammate its lead stopped', () => {
    const item = testSession(2, { team: testTeammateTeam(testRef(1), true) })

    expect(stoppedNote(item, testSessionsT)).toBe('stopped')
  })

  it('has no note for a teammate that was not stopped', () => {
    const item = testSession(2, { team: testTeammateTeam(testRef(1)) })

    expect(stoppedNote(item, testSessionsT)).toBeNull()
  })

  it('has no note for a session that is not a teammate', () => {
    expect(stoppedNote(testSession(1), testSessionsT)).toBeNull()
  })
})

describe('folderNote', () => {
  it('names the folder of a session from another folder', () => {
    const item = testSession(1, { projectDirName: '-other' })

    expect(folderNote(item, '-p', testSessionsT)).toBe('in -other')
  })

  it('has no note for a session in the list’s own folder', () => {
    expect(folderNote(testSession(1, { projectDirName: '-p' }), '-p', testSessionsT)).toBeNull()
  })
})

describe('archivedNote', () => {
  it('notes a session whose transcript was removed', () => {
    expect(archivedNote(testSession(1, { archived: true }), testSessionsT)).toBe('archived')
  })

  it('has no note for a session read from disk', () => {
    expect(archivedNote(testSession(1), testSessionsT)).toBeNull()
  })
})
