import { afterEach, describe, expect, it } from 'vitest'
import { useNavigationStore } from '../useNavigationStore'

const ref = { projectDirName: '-Users-a-repo', sessionId: '11111111-1111-4111-8111-111111111111' }

afterEach(() => {
  useNavigationStore.setState({ navigationCount: 0 })
  useNavigationStore.getState().reset()
})

describe('useNavigationStore', () => {
  it('starts on the sessions view with nothing selected', () => {
    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgentId: null
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
      selectedAgentId: null
    })
  })

  it('shows a session with the given agent selected', () => {
    useNavigationStore.getState().showSession(ref, 'agent-a1')

    expect(useNavigationStore.getState().selectedAgentId).toBe('agent-a1')
  })

  it('clears the selected session and agent when returning to the sessions list', () => {
    useNavigationStore.getState().showSession(ref, 'agent-a1')

    useNavigationStore.getState().showSessions()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgentId: null
    })
  })

  it('clears the selected session and agent when showing the overview', () => {
    useNavigationStore.getState().showSession(ref, 'agent-a1')

    useNavigationStore.getState().showOverview()

    expect(useNavigationStore.getState()).toMatchObject({
      selectedSessionRef: null,
      selectedAgentId: null
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
    useNavigationStore.getState().showSession(ref, 'agent-a1')

    useNavigationStore.getState().reset()

    expect(useNavigationStore.getState()).toMatchObject({
      view: 'sessions',
      selectedSessionRef: null,
      selectedAgentId: null
    })
  })
})
