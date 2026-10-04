import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '../useNavigationStore'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }
const subagent = { kind: 'subagent', ownerRef: ref, agentId: 'agent-a1' } as const
const teammate = {
  kind: 'teammate',
  ref: { projectDirName: '-Users-a-other', sessionId: '22222222-2222-4222-8222-222222222222' }
} as const

afterEach(() => {
  useNavigationStore.setState({ navigationCount: 0 })
  useNavigationStore.getState().reset()
})

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
