import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { pruneStaleDailyUsage } from '../pruneStaleDailyUsage'
import { testDailyUsage } from '../testDailyUsage'

const keys = (client: QueryClient): string[] =>
  client
    .getQueryCache()
    .findAll()
    .map((query) => query.queryKey.join('/'))
    .sort()

function clientWith(...entries: readonly (readonly unknown[])[]): QueryClient {
  const client = new QueryClient()
  for (const key of entries) client.setQueryData(key, testDailyUsage({ '2026-03-10': {} }))
  return client
}

describe('pruneStaleDailyUsage', () => {
  it('removes the folder’s usage for other days and keeps today’s, in both windows', () => {
    const client = clientWith(
      ['projectDailyUsage', '-a', '7d', '2026-03-09'],
      ['projectDailyUsage', '-a', '30d', '2026-03-09'],
      ['projectDailyUsage', '-a', '7d', '2026-03-10'],
      ['projectDailyUsage', '-a', '30d', '2026-03-10']
    )

    pruneStaleDailyUsage(client, { dirName: '-a', todayKey: '2026-03-10' })

    expect(keys(client)).toEqual([
      'projectDailyUsage/-a/30d/2026-03-10',
      'projectDailyUsage/-a/7d/2026-03-10'
    ])
  })

  it('leaves other folders and other queries alone', () => {
    const client = clientWith(
      ['projectDailyUsage', '-b', '7d', '2026-03-09'],
      ['projectTotals', '-a', '7d'],
      ['projectDailyUsage', '-a', '7d', '2026-03-09']
    )

    pruneStaleDailyUsage(client, { dirName: '-a', todayKey: '2026-03-10' })

    expect(keys(client)).toEqual(['projectDailyUsage/-b/7d/2026-03-09', 'projectTotals/-a/7d'])
  })
})
