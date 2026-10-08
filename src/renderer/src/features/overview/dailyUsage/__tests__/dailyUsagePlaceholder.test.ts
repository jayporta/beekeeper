import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createDailyUsagePlaceholder, placeholderRange } from '../dailyUsagePlaceholder'
import { testDailyUsage } from '../testDailyUsage'

const usage = testDailyUsage({ '2026-03-10': { a: 1 } })

describe('createDailyUsagePlaceholder', () => {
  it('gives the folder’s newest cached usage', () => {
    const client = new QueryClient()
    client.setQueryData(['projectDailyUsage', '-a', '7d', '2026-03-09'], usage)

    expect(createDailyUsagePlaceholder(client, { dirName: '-a', range: '7d' })()).toBe(usage)
  })

  it('records which window the usage it gave belongs to', () => {
    const client = new QueryClient()
    client.setQueryData(['projectDailyUsage', '-a', '30d', '2026-03-09'], usage)

    const given = createDailyUsagePlaceholder(client, { dirName: '-a', range: '7d' })()

    expect(given === undefined ? undefined : placeholderRange(given)).toBe('30d')
  })

  it('gives nothing for a folder with no cached usage', () => {
    expect(
      createDailyUsagePlaceholder(new QueryClient(), { dirName: '-a', range: '7d' })()
    ).toBeUndefined()
  })

  it('remembers a miss, so a folder with nothing cached is not searched for again', () => {
    const client = new QueryClient()
    const reads = vi.spyOn(client, 'getQueriesData')
    const placeholder = createDailyUsagePlaceholder(client, { dirName: '-a', range: '7d' })

    for (let i = 0; i < 5; i += 1) placeholder()

    expect(reads).toHaveBeenCalledTimes(1)
  })

  it('searches again from a fresh placeholder, as when the window or day changes', () => {
    const client = new QueryClient()
    createDailyUsagePlaceholder(client, { dirName: '-a', range: '7d' })()
    client.setQueryData(['projectDailyUsage', '-a', '7d', '2026-03-09'], usage)

    expect(createDailyUsagePlaceholder(client, { dirName: '-a', range: '7d' })()).toBe(usage)
  })
})

describe('placeholderRange', () => {
  it('is undefined for usage that was never given as a placeholder', () => {
    expect(placeholderRange(testDailyUsage({}))).toBeUndefined()
  })
})
