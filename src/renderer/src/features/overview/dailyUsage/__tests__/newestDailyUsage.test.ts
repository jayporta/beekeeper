import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { newestDailyUsage } from '../newestDailyUsage'
import { testDailyUsage } from '../testDailyUsage'

const usage = (tokens: number): ReturnType<typeof testDailyUsage> =>
  testDailyUsage({ '2026-03-10': { a: tokens } })

function store(
  client: QueryClient,
  key: readonly unknown[],
  tokens: number,
  updatedAt: number
): void {
  client.setQueryData(key, usage(tokens), { updatedAt })
}

describe('newestDailyUsage', () => {
  it('is the most recently fetched usage of the folder, whatever its window or day', () => {
    const client = new QueryClient()
    store(client, ['projectDailyUsage', '-a', '7d', '2026-03-09'], 1, 1000)
    store(client, ['projectDailyUsage', '-a', '30d', '2026-03-10'], 2, 3000)
    store(client, ['projectDailyUsage', '-a', '7d', '2026-03-10'], 3, 2000)

    expect(newestDailyUsage(client, '-a')).toEqual({ usage: usage(2), range: '30d' })
  })

  it('ignores other folders and other queries', () => {
    const client = new QueryClient()
    store(client, ['projectDailyUsage', '-b', '7d', '2026-03-10'], 9, 5000)
    store(client, ['projectTotals', '-a', '7d'], 9, 5000)
    store(client, ['projectDailyUsage', '-a', '7d', '2026-03-10'], 1, 1000)

    expect(newestDailyUsage(client, '-a')?.usage).toEqual(usage(1))
  })

  it('is undefined when the folder has none', () => {
    const client = new QueryClient()
    store(client, ['projectDailyUsage', '-b', '7d', '2026-03-10'], 1, 1000)

    expect(newestDailyUsage(client, '-a')).toBeUndefined()
  })

  it('skips a query that holds no data yet', () => {
    const client = new QueryClient()
    void client.prefetchQuery({
      queryKey: ['projectDailyUsage', '-a', '7d', '2026-03-11'],
      queryFn: () => new Promise(() => undefined)
    })
    store(client, ['projectDailyUsage', '-a', '7d', '2026-03-10'], 1, 1000)

    expect(newestDailyUsage(client, '-a')?.usage).toEqual(usage(1))
  })
})
