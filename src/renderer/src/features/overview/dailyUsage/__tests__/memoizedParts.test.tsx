import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DailyUsageChart } from '../DailyUsageChart'
import { DailyUsageLegend } from '../DailyUsageLegend'
import { DailyUsageTable } from '../DailyUsageTable'
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
      <DailyUsageTable days={days} total={total} series={series} range="7d" />
    </>
  )
}

describe('the chart, legend and table', () => {
  it('draw once, and not again when their parent renders again with the same props', () => {
    render(<Parent />)
    const labelDraws = vi.mocked(dayLabels).mock.calls.length
    const seriesDraws = vi.mocked(seriesLabel).mock.calls.length
    expect(labelDraws).toBeGreaterThan(0)
    expect(seriesDraws).toBeGreaterThan(0)

    act(() => {
      screen.getByRole('button', { name: 'again' }).click()
    })

    expect(vi.mocked(dayLabels).mock.calls.length).toBe(labelDraws)
    expect(vi.mocked(seriesLabel).mock.calls.length).toBe(seriesDraws)
  })

  it('draw the table once on its own too', () => {
    render(<TableParent />)
    const rowLabelDraws = vi.mocked(dayLabels).mock.calls.length

    act(() => {
      screen.getByRole('button', { name: 'again' }).click()
    })

    expect(vi.mocked(dayLabels).mock.calls.length).toBe(rowLabelDraws)
  })
})

/** Renders only the table, so its own draws are told apart from the chart's. */
function TableParent(): React.JSX.Element {
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
      <DailyUsageTable days={days} total={total} series={series} range="7d" />
    </>
  )
}
