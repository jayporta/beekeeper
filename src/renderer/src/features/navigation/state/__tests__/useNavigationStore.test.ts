import { afterEach, describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, type NavEntry } from '../navigationHistory'
import { useNavigationStore } from '../useNavigationStore'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }
const subagent = { kind: 'subagent', ownerRef: ref, agentId: 'agent-a1' } as const
const teammate = {
  kind: 'teammate',
  ref: { projectDirName: '-Users-a-other', sessionId: '22222222-2222-4222-8222-222222222222' }
} as const

const OTHER = '-Users-a-other'

afterEach(() => {
  useNavigationStore.setState(useNavigationStore.getInitialState(), true)
})

/** Puts the store on `dirName` as the project in effect, as the app does once the project list loads. */
function inProject(dirName: string): void {
  useNavigationStore.getState().syncProject(dirName)
}

/** The store's history, oldest first. */
function history(): readonly NavEntry[] {
  return useNavigationStore.getState().history
}

describe('useNavigationStore', () => {
  it('starts on the sessions view with nothing selected', () => {
    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgent: null
    })
  })

  it('shows the overview', () => {
    useNavigationStore.getState().showOverview()

    expect(useNavigationStore.getState().view).toBe('overview')
  })

  it('shows a session with no agent selected when none is given', () => {
    useNavigationStore.getState().showSession(ref)

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: ref,
      selectedAgent: null
    })
  })

  it('shows a session with the given subagent selected', () => {
    useNavigationStore.getState().showSession(ref, subagent)

    expect(useNavigationStore.getState().selectedAgent).toEqual(subagent)
  })

  it('shows a session with a teammate selected by its own session ref, which may be in another folder', () => {
    useNavigationStore.getState().showSession(ref, teammate)

    expect(useNavigationStore.getState().selectedAgent).toEqual(teammate)
  })

  it('clears the selected session and agent when returning to the sessions list', () => {
    useNavigationStore.getState().showSession(ref, subagent)

    useNavigationStore.getState().showSessions()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgent: null
    })
  })

  it('clears the selected session and agent when showing the overview', () => {
    useNavigationStore.getState().showSession(ref, subagent)

    useNavigationStore.getState().showOverview()

    expect(useNavigationStore.getState()).toMatchObject({
      selectedSessionRef: null,
      selectedAgent: null
    })
  })

  it('counts each navigation the person starts', () => {
    const { showOverview, showSessions, showSession } = useNavigationStore.getState()

    showOverview()
    showSessions()
    showSession(ref)

    expect(useNavigationStore.getState().navigationCount).toBe(3)
  })

  it('does not count a reset, which the app does on its own', () => {
    useNavigationStore.getState().showSession(ref)

    useNavigationStore.getState().reset()

    expect(useNavigationStore.getState().navigationCount).toBe(1)
  })

  it('returns to the starting state on reset', () => {
    useNavigationStore.getState().showSession(ref, subagent)

    useNavigationStore.getState().reset()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgent: null
    })
  })

  it('selects an agent in the session on show without counting a navigation', () => {
    useNavigationStore.getState().showSession(ref)
    const before = useNavigationStore.getState().navigationCount

    useNavigationStore.getState().selectAgent(subagent)

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: ref,
      selectedAgent: subagent,
      navigationCount: before
    })
  })

  it('selects the lead again by clearing the selected agent', () => {
    useNavigationStore.getState().showSession(ref, teammate)

    useNavigationStore.getState().selectAgent(null)

    expect(useNavigationStore.getState().selectedAgent).toBeNull()
  })
})

describe('useNavigationStore history', () => {
  it('starts with no history', () => {
    expect(history()).toEqual([])
  })

  it('records the sessions list when the overview is shown', () => {
    inProject(ref.projectDirName)

    useNavigationStore.getState().showOverview()

    expect(history()).toEqual([
      { view: 'sessions', projectDirName: ref.projectDirName, sessionRef: null, agent: null }
    ])
  })

  it('records the overview, with no project, when a project opens from it', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showOverview()

    useNavigationStore.getState().showSessions(OTHER)

    expect(history().at(-1)).toEqual({
      view: 'overview',
      projectDirName: null,
      sessionRef: null,
      agent: null
    })
  })

  it('records the sessions list when a session is shown', () => {
    inProject(ref.projectDirName)

    useNavigationStore.getState().showSession(ref)

    expect(history()).toEqual([
      { view: 'sessions', projectDirName: ref.projectDirName, sessionRef: null, agent: null }
    ])
  })

  it('records the session and the agent selected when the sessions list is shown again', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)
    useNavigationStore.getState().selectAgent(subagent)

    useNavigationStore.getState().showSessions()

    expect(history().at(-1)).toEqual({
      view: 'session',
      projectDirName: ref.projectDirName,
      sessionRef: ref,
      agent: subagent
    })
  })

  it('records a session under the project in effect, not the project named by its ref', () => {
    inProject(OTHER)
    useNavigationStore.getState().showSession(ref)

    useNavigationStore.getState().showSessions()

    expect(history().at(-1)?.projectDirName).toBe(OTHER)
  })

  it('records the sessions list of the project left when another project opens', () => {
    inProject(ref.projectDirName)

    useNavigationStore.getState().showSessions(OTHER)

    expect(history()).toEqual([
      { view: 'sessions', projectDirName: ref.projectDirName, sessionRef: null, agent: null }
    ])
    expect(useNavigationStore.getState().currentProjectDirName).toBe(OTHER)
  })

  it('records a session when another session replaces it', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)

    useNavigationStore.getState().showSession(teammate.ref)

    expect(history().at(-1)).toMatchObject({ view: 'session', sessionRef: ref })
  })

  it('records the session when the agent shown in it changes through a navigation', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref, subagent)

    useNavigationStore.getState().showSession(ref, teammate)

    expect(history().at(-1)).toMatchObject({ view: 'session', agent: subagent })
  })

  it('records nothing when an agent is selected', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)
    const before = history()

    useNavigationStore.getState().selectAgent(subagent)

    expect(history()).toEqual(before)
  })

  it('records nothing when the view on show is shown again', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showOverview()
    useNavigationStore.getState().showOverview()
    useNavigationStore.getState().showSessions()
    useNavigationStore.getState().showSessions()
    useNavigationStore.getState().showSession(ref, subagent)
    useNavigationStore.getState().showSession(ref, subagent)

    expect(history()).toHaveLength(3)
  })

  it('records nothing when the sessions list of the project in effect is shown again by name', () => {
    inProject(ref.projectDirName)

    useNavigationStore.getState().showSessions(ref.projectDirName)

    expect(history()).toEqual([])
  })

  it('still counts a navigation that records nothing, so focus moves', () => {
    useNavigationStore.getState().showSessions()

    expect(useNavigationStore.getState().navigationCount).toBe(1)
  })

  it('keeps only the newest entries once the history passes its limit', () => {
    inProject(ref.projectDirName)
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      useNavigationStore
        .getState()
        .showSession({ projectDirName: ref.projectDirName, sessionId: `session-${i}` })
    }

    expect(history()).toHaveLength(HISTORY_LIMIT)
    expect(history().at(-1)?.sessionRef?.sessionId).toBe(`session-${HISTORY_LIMIT + 3}`)
    expect(history()[0]?.sessionRef?.sessionId).toBe('session-4')
  })

  it('leaves the history alone on reset, which the app does on its own', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)
    const before = history()

    useNavigationStore.getState().reset()

    expect(history()).toEqual(before)
  })

  it('shows a session without recording it when the sessions list replaces it', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)
    const before = history()

    useNavigationStore.getState().replaceWithSessions()

    expect(history()).toEqual(before)
    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null
    })
  })

  it('counts the replacement as a navigation, so focus moves', () => {
    useNavigationStore.getState().showSession(ref)

    useNavigationStore.getState().replaceWithSessions()

    expect(useNavigationStore.getState().navigationCount).toBe(2)
  })
})

describe('useNavigationStore going back', () => {
  it('removes and returns the newest entry', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showOverview()
    useNavigationStore.getState().showSession(ref)

    const entry = useNavigationStore.getState().popEntry()

    expect(entry).toMatchObject({ view: 'overview' })
    expect(history()).toHaveLength(1)
  })

  it('returns nothing from an empty history', () => {
    expect(useNavigationStore.getState().popEntry()).toBeUndefined()
  })

  it('shows the view and selection of an entry, and counts it as a navigation', () => {
    useNavigationStore.getState().restore({
      view: 'session',
      projectDirName: ref.projectDirName,
      sessionRef: ref,
      agent: subagent
    })

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'session',
      selectedSessionRef: ref,
      selectedAgent: subagent,
      currentProjectDirName: ref.projectDirName,
      navigationCount: 1
    })
  })

  it('records nothing when it restores an entry', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().showSession(ref)
    const before = history()

    useNavigationStore.getState().restore({
      view: 'sessions',
      projectDirName: ref.projectDirName,
      sessionRef: null,
      agent: null
    })

    expect(history()).toEqual(before)
  })

  it('keeps the project in effect when it restores the overview', () => {
    inProject(ref.projectDirName)

    useNavigationStore.getState().restore({
      view: 'overview',
      projectDirName: null,
      sessionRef: null,
      agent: null
    })

    expect(useNavigationStore.getState().currentProjectDirName).toBe(ref.projectDirName)
  })

  it('records the project a restore is about to select, until the app syncs to it', () => {
    inProject(ref.projectDirName)
    useNavigationStore.getState().markRestoringProject(OTHER)

    expect(useNavigationStore.getState().restoringProject).toBe(OTHER)

    useNavigationStore.getState().syncProject(OTHER)

    expect(useNavigationStore.getState().restoringProject).toBeNull()
  })
})
