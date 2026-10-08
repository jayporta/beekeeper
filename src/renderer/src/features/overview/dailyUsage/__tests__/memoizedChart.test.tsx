import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DailyUsageChart } from '../DailyUsageChart'
import { DailyUsageLegend } from '../DailyUsageLegend'
import { dayLabels } from '../dayLabels'
import { seriesLabel } from '../seriesLabel'
import { seriesOf } from '../seriesOf'
import { OCTOBER_WEEK, testSummary } from '../testDailyUsage'

// Counting calls to what each part does while it renders tells a render from a skipped one.
vi.mock('../dayLabels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dayLabels')>()
  return { dayLabels: vi.fn(actual.dayLabels) }
})
vi.mock('../seriesLabel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../seriesLabel')>()
  return { seriesLabel: vi.fn(actual.seriesLabel) }
})

const { days, total } = testSummary(OCTOBER_WEEK)
const series = seriesOf(days)

/** Renders the parts with the same props each time, and renders their parent again on demand. */
function Parent(): React.JSX.Element {
  const [, setCount] = useState(0)
  return (
    <>
      <button
        onClick={() => {
          setCount((count) => count + 1)
        }}
      >
        again
      </button>
      <DailyUsageChart days={days} total={total} series={series} range="7d" />
      <DailyUsageLegend series={series} />
    </>
  )
}

describe('the chart and legend', () => {
  it('draw once, and not again when their parent renders again with the same props', () => {
    render(<Parent />)
    const chartDraws = vi.mocked(dayLabels).mock.calls.length
    const legendDraws = vi.mocked(seriesLabel).mock.calls.length
    expect(chartDraws).toBeGreaterThan(0)
    expect(legendDraws).toBeGreaterThan(0)

    act(() => {
      screen.getByRole('button', { name: 'again' }).click()
    })

    expect(vi.mocked(dayLabels).mock.calls.length).toBe(chartDraws)
    expect(vi.mocked(seriesLabel).mock.calls.length).toBe(legendDraws)
  })
})
