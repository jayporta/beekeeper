import { afterEach, describe, expect, it } from 'vitest'
import { useExpandedProjectsStore } from '../state/useExpandedProjectsStore'

afterEach(() => {
  useExpandedProjectsStore.setState({ toggled: {} })
})

describe('useExpandedProjectsStore', () => {
  it('starts with no group chosen', () => {
    expect(useExpandedProjectsStore.getState().toggled).toEqual({})
  })

  it('records a group opened or closed, by folder name', () => {
    useExpandedProjectsStore.getState().setExpanded('-a', true)
    useExpandedProjectsStore.getState().setExpanded('-b', false)

    expect(useExpandedProjectsStore.getState().toggled).toEqual({ '-a': true, '-b': false })
  })

  it('replaces an earlier choice for the same group and keeps the others', () => {
    useExpandedProjectsStore.getState().setExpanded('-a', true)
    useExpandedProjectsStore.getState().setExpanded('-b', true)
    useExpandedProjectsStore.getState().setExpanded('-a', false)

    expect(useExpandedProjectsStore.getState().toggled).toEqual({ '-a': false, '-b': true })
  })
})
