import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_SORT, useProjectSortStore } from '../useProjectSortStore'

afterEach(() => {
  useProjectSortStore.setState({ sort: DEFAULT_PROJECT_SORT })
})

describe('useProjectSortStore', () => {
  it('starts sorted by tokens', () => {
    expect(useProjectSortStore.getState().sort).toBe('tokens')
  })

  it('changes the sort', () => {
    useProjectSortStore.getState().setSort('name')

    expect(useProjectSortStore.getState().sort).toBe('name')
  })
})
