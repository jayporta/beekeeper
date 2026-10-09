import { QueryClient, type Query, type QueryKey } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { testProject } from '@renderer/testBeekeeperApi'
import { allowsBackgroundRefetch } from '../backgroundRefetchRules'

interface Settled {
  readonly data?: unknown
  readonly error?: Error
}

/** A query already in the cache in the given state: loaded, or failed with or without data. */
function queryIn(queryKey: QueryKey, { data, error }: Settled): Query {
  const client = new QueryClient()
  const query = client.getQueryCache().build(client, { queryKey })
  if (error) {
    query.setState({
      status: 'error',
      error,
      data,
      fetchStatus: 'idle'
    })
  } else if (data !== undefined) {
    query.setState({ status: 'success', data, fetchStatus: 'idle' })
  }
  return query
}

const failure = new IpcCallError('internal')
const notFound = new IpcCallError('not-found')

describe('allowsBackgroundRefetch', () => {
  it.each([
    ['projects', ['projects']],
    ['sessions', ['sessions', 'a']],
    ['session', ['session', 'a', 's']]
  ])('allows a %s query that has not failed', (_root, queryKey) => {
    expect(allowsBackgroundRefetch(queryIn(queryKey, { data: [] }))).toBe(true)
  })

  it('allows a query that is still loading', () => {
    expect(allowsBackgroundRefetch(queryIn(['sessions', 'a'], {}))).toBe(true)
  })

  describe('a failed project list', () => {
    it('is left alone when no projects are shown', () => {
      expect(allowsBackgroundRefetch(queryIn(['projects'], { error: failure, data: [] }))).toBe(
        false
      )
    })

    it('is refetched when it still shows projects', () => {
      const projects = [testProject('a')]
      expect(
        allowsBackgroundRefetch(queryIn(['projects'], { error: failure, data: projects }))
      ).toBe(true)
    })
  })

  describe('a failed session list', () => {
    it('is left alone when it has no data', () => {
      expect(allowsBackgroundRefetch(queryIn(['sessions', 'a'], { error: failure }))).toBe(false)
    })

    it('is left alone when its folder is gone, whatever its data', () => {
      expect(
        allowsBackgroundRefetch(queryIn(['sessions', 'a'], { error: notFound, data: [] }))
      ).toBe(false)
    })

    it('is refetched when it still shows its data', () => {
      expect(
        allowsBackgroundRefetch(queryIn(['sessions', 'a'], { error: failure, data: [] }))
      ).toBe(true)
    })
  })

  describe('a failed session detail', () => {
    it('is left alone when it has no data', () => {
      expect(allowsBackgroundRefetch(queryIn(['session', 'a', 's'], { error: failure }))).toBe(
        false
      )
    })

    it('is refetched when it still shows its data', () => {
      expect(
        allowsBackgroundRefetch(queryIn(['session', 'a', 's'], { error: failure, data: {} }))
      ).toBe(true)
    })
  })

  it('allows a failed query of any other root', () => {
    expect(allowsBackgroundRefetch(queryIn(['other', 'a'], { error: failure }))).toBe(true)
  })
})
