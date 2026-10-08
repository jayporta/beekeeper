import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { totalsLimiterFor } from '../../totalsLimiter'
import { MAX_DAILY_USAGE_IN_FLIGHT, dailyUsageLimiterFor } from '../dailyUsageLimiter'

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('dailyUsageLimiterFor', () => {
  it('allows one folder at a time', async () => {
    expect(MAX_DAILY_USAGE_IN_FLIGHT).toBe(1)
    const limiter = dailyUsageLimiterFor(new QueryClient())
    let release = (): void => {}
    let secondStarted = false
    void limiter.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        })
    )
    void limiter.run(() => {
      secondStarted = true
      return Promise.resolve()
    })

    await settle()
    expect(secondStarted).toBe(false)
    release()
    await settle()
    expect(secondStarted).toBe(true)
  })

  it('gives one limiter per query client', () => {
    const client = new QueryClient()

    expect(dailyUsageLimiterFor(client)).toBe(dailyUsageLimiterFor(client))
    expect(dailyUsageLimiterFor(new QueryClient())).not.toBe(dailyUsageLimiterFor(client))
  })

  it('is not the totals limiter, so the sidebar’s totals keep their slots', () => {
    const client = new QueryClient()

    expect(dailyUsageLimiterFor(client)).not.toBe(totalsLimiterFor(client))
  })
})
