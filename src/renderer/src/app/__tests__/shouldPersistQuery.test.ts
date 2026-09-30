import { describe, expect, it } from 'vitest'
import { shouldPersistQuery } from '../shouldPersistQuery'

const query = (
  queryKey: readonly unknown[],
  status = 'success'
): { queryKey: readonly unknown[]; state: { status: string } } => ({
  queryKey,
  state: { status }
})

describe('shouldPersistQuery', () => {
  it.each([['projects'], ['sessions']])('persists a successful %s query', (root) => {
    expect(shouldPersistQuery(query([root, 'some-project']))).toBe(true)
  })

  it('persists a successful query whose whole key is the root', () => {
    expect(shouldPersistQuery(query(['projects']))).toBe(true)
  })

  it.each([['pending'], ['error']])('does not persist a query in the %s state', (status) => {
    expect(shouldPersistQuery(query(['projects'], status))).toBe(false)
  })

  it('does not persist a query under any other root', () => {
    expect(shouldPersistQuery(query(['session-detail', 'abc']))).toBe(false)
  })

  it('does not match a root by prefix of its first element', () => {
    expect(shouldPersistQuery(query(['projectsExtra']))).toBe(false)
  })

  it('does not persist a query whose key has a non-string root or is empty', () => {
    expect(shouldPersistQuery(query([{ root: 'projects' }]))).toBe(false)
    expect(shouldPersistQuery(query([]))).toBe(false)
  })
})
