import { describe, expect, it } from 'vitest'
import { appendEntry, entryOf, HISTORY_LIMIT, sameEntry, type NavEntry } from '../navigationHistory'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }
const sessionsOfA: NavEntry = {
  view: 'sessions',
  projectDirName: 'a',
  sessionRef: null,
  agent: null
}

describe('sameEntry', () => {
  it('matches entries equal in view, project, session and agent', () => {
    const session: NavEntry = {
      view: 'session',
      projectDirName: 'a',
      sessionRef: ref,
      agent: { kind: 'teammate', ref }
    }
    const copy: NavEntry = {
      ...session,
      sessionRef: { ...ref },
      agent: { kind: 'teammate', ref: { ...ref } }
    }

    expect(sameEntry(session, copy)).toBe(true)
  })

  it('tells the same view in two projects apart', () => {
    expect(sameEntry(sessionsOfA, { ...sessionsOfA, projectDirName: 'b' })).toBe(false)
  })

  it('tells two views apart', () => {
    expect(sameEntry(sessionsOfA, { ...sessionsOfA, view: 'overview' })).toBe(false)
  })

  it('tells two sessions apart', () => {
    const session: NavEntry = { ...sessionsOfA, view: 'session', sessionRef: ref }

    expect(sameEntry(session, { ...session, sessionRef: { ...ref, sessionId: 'other' } })).toBe(
      false
    )
    expect(sameEntry(sessionsOfA, session)).toBe(false)
  })

  it('tells two agents in one session apart', () => {
    const session: NavEntry = { ...sessionsOfA, view: 'session', sessionRef: ref }

    expect(sameEntry(session, { ...session, agent: { kind: 'teammate', ref } })).toBe(false)
  })
})

describe('entryOf', () => {
  it('names the project in effect for a sessions list and a session', () => {
    const state = { selectedSessionRef: ref, selectedAgent: null, currentProjectDirName: 'a' }

    expect(entryOf({ ...state, view: 'sessions' }).projectDirName).toBe('a')
    expect(entryOf({ ...state, view: 'session' }).projectDirName).toBe('a')
  })

  it('names no project for the overview, which is about none', () => {
    expect(
      entryOf({
        view: 'overview',
        selectedSessionRef: null,
        selectedAgent: null,
        currentProjectDirName: 'a'
      }).projectDirName
    ).toBeNull()
  })
})

describe('appendEntry', () => {
  it('adds the entry at the end without changing the history it was given', () => {
    const history: readonly NavEntry[] = [sessionsOfA]

    const next = appendEntry(history, { ...sessionsOfA, view: 'overview', projectDirName: null })

    expect(next).toHaveLength(2)
    expect(history).toHaveLength(1)
  })

  it('drops the oldest entry once the history is full', () => {
    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => ({
      ...sessionsOfA,
      projectDirName: `p${i}`
    }))

    const next = appendEntry(full, sessionsOfA)

    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0]?.projectDirName).toBe('p1')
    expect(next.at(-1)).toEqual(sessionsOfA)
  })
})
