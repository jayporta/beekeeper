import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { IpcResult } from '../../../../../../shared/ipc/ipcResult'
import type { ProjectDailyUsageDto } from '../../../../../../shared/ipc/projectDailyUsageDto'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { useTotalsWindowStore } from '../../state/useTotalsWindowStore'
import { listing } from '../../testProjectListing'
import { DailyUsageSection } from '../DailyUsageSection'
import { OCTOBER_WEEK, dayKeys, testDailyUsage } from '../testDailyUsage'

afterEach(() => {
  useTotalsWindowStore.setState({ window: '7d' })
})

type Reply = IpcResult<ProjectDailyUsageDto>
const week = (partial: Parameters<typeof testDailyUsage>[1] = {}): Reply => ({
  ok: true,
  value: testDailyUsage(OCTOBER_WEEK, partial)
})
const month = (): Reply => ({
  ok: true,
  value: testDailyUsage(Object.fromEntries(dayKeys(30, '2026-10-07').map((day) => [day, { a: 5 }])))
})
const failed: Reply = { ok: false, error: { code: 'unreadable' } }
const never = (): Promise<Reply> => new Promise(() => undefined)

function renderSection(
  usage: (dirName: string, window: string) => Promise<Reply>,
  dirs: readonly string[] = ['-a']
): void {
  installBeekeeperApi({ listProjects: listing(...dirs), getProjectDailyUsage: usage })
  render(<DailyUsageSection />, { wrapper: createQueryWrapper() })
}

const chart = (): Promise<HTMLElement> => screen.findByRole('img', { name: /^Tokens per day/ })

describe('DailyUsageSection', () => {
  it('has a level two heading naming the section', async () => {
    renderSection(() => Promise.resolve(week()))

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Tokens per day, by model'
    })
    expect(screen.getByRole('region', { name: 'Tokens per day, by model' })).toBeTruthy()
    expect(heading.tagName).toBe('H2')
  })

  it('shows the chart named for its total, with the legend and the note', async () => {
    renderSection(() => Promise.resolve(week()))

    expect((await chart()).getAttribute('aria-label')).toContain('41.2M in all')
    expect(screen.getByRole('list', { name: 'Models' })).toBeTruthy()
    expect(
      screen.getByText(
        'Tokens count on the day each message ran, so this can differ from the totals above.'
      )
    ).toBeTruthy()
  })

  it('shows "Other models" in the legend when more than four models ran', async () => {
    const many = testDailyUsage({ '2026-10-07': { a: 6, b: 5, c: 4, d: 3, e: 2 } })
    renderSection(() => Promise.resolve({ ok: true, value: many }))

    const legend = await screen.findByRole('list', { name: 'Models' })
    expect(within(legend).getByText('Other models')).toBeTruthy()
  })
})

describe('DailyUsageSection table', () => {
  it('opens and closes a table with a button whose name stays the same and whose state is aria-expanded', async () => {
    const user = userEvent.setup()
    renderSection(() => Promise.resolve(week()))
    await chart()
    const button = screen.getByRole('button', { name: 'Tokens per day as a table' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(button)

    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.textContent).toBe('Tokens per day as a table')
    const table = screen.getByRole('table')
    const controlled = document.getElementById(button.getAttribute('aria-controls') ?? '')
    expect(controlled?.contains(table)).toBe(true)
    await user.click(button)
    expect(screen.queryByRole('table')).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  it('has a row for each day of the window, 7 then 30 after the window changes', async () => {
    const user = userEvent.setup()
    renderSection((_dir, window) => Promise.resolve(window === '7d' ? week() : month()))
    await chart()
    await user.click(screen.getByRole('button', { name: 'Tokens per day as a table' }))
    // One row per day, a total row, and the header row.
    expect(screen.getAllByRole('row')).toHaveLength(7 + 2)

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(30 + 2)
    })
  })

  it('totals the table to the sum of every day', async () => {
    const user = userEvent.setup()
    renderSection(() => Promise.resolve(week()))
    await chart()
    await user.click(screen.getByRole('button', { name: 'Tokens per day as a table' }))

    const footer = screen.getByRole('row', { name: /^Total/ })
    const cells = within(footer).getAllByRole('cell')
    expect(cells.at(-1)?.textContent).toBe('41,200,000')
  })
})

describe('DailyUsageSection while loading and when partial', () => {
  it('says it is loading and is busy before any folder answers', async () => {
    renderSection(never)

    expect(await screen.findByText('Loading tokens per day')).toBeTruthy()
    expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('is not busy once every folder has answered', async () => {
    renderSection(() => Promise.resolve(week()))
    await chart()

    expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('false')
  })

  it('shows the error in place of the chart when every folder failed', async () => {
    renderSection(() => Promise.resolve(failed), ['-a', '-b'])

    expect(await screen.findByText("Couldn't load tokens per day.")).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tokens per day as a table' })).toBeNull()
  })

  it('keeps the chart and explains it when one folder failed', async () => {
    renderSection((dir) => Promise.resolve(dir === '-a' ? failed : week()), ['-a', '-b'])

    await chart()
    expect(
      await screen.findByText(
        "¹ Partial: Some projects couldn't be read. A day's total may be low."
      )
    ).toBeTruthy()
    expect(screen.getByText('partial, see the note under the chart')).toBeTruthy()
  })

  it('names each partial reason in the footnote', async () => {
    renderSection(() =>
      Promise.resolve(week({ skippedLines: 1, undated: 1, unreadable: 1, unreadableSubagents: 1 }))
    )

    expect(
      await screen.findByText(
        "¹ Partial: Some sessions couldn't be read. Some sessions have unreadable lines. Some sessions have messages with no timestamp, so those messages are on no day. Some sessions have subagent files that couldn't be read. A day's total may be low."
      )
    ).toBeTruthy()
  })

  it('has no footnote when nothing is partial', async () => {
    renderSection(() => Promise.resolve(week()))
    await chart()

    expect(screen.queryByText(/Partial:/)).toBeNull()
  })

  it('keeps the chart at full contrast and says it is updating while the other window’s figures stand in', async () => {
    const thirty = new Promise<Reply>(() => undefined)
    renderSection((_dir, window) => (window === '7d' ? Promise.resolve(week()) : thirty))
    await chart()

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    await screen.findByText('Updating')
    expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('img', { name: /41\.2M in all/ })).toBeTruthy()
  })
})

describe('DailyUsageSection announcements', () => {
  const status = (): HTMLElement => within(screen.getByRole('region')).getByRole('status')

  it('says nothing while the usage loads', async () => {
    renderSection(never)

    await screen.findByText('Loading tokens per day')

    expect(status().textContent).toBe('')
  })

  it('says once that the usage arrived, when every folder has', async () => {
    renderSection(() => Promise.resolve(week()), ['-a', '-b'])

    await waitFor(() => {
      expect(status().textContent).toBe('Tokens per day for the last 7 days updated')
    })
  })

  it('says some days may be low when the usage is partial', async () => {
    renderSection(() => Promise.resolve(week({ skippedLines: 1 })))

    await waitFor(() => {
      expect(status().textContent).toBe(
        'Tokens per day for the last 7 days updated. Some days may be low, see the note under the chart.'
      )
    })
  })

  it('says it could not load when every folder failed', async () => {
    renderSection(() => Promise.resolve(failed))

    await waitFor(() => {
      expect(status().textContent).toBe("Couldn't load tokens per day for the last 7 days")
    })
  })

  it('says nothing about the new window until its usage has arrived', async () => {
    const thirty = new Promise<Reply>(() => undefined)
    renderSection((_dir, window) => (window === '7d' ? Promise.resolve(week()) : thirty))
    await waitFor(() => {
      expect(status().textContent).toBe('Tokens per day for the last 7 days updated')
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })
    await screen.findByText('Updating')
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(status().textContent).not.toContain('30 days')
  })

  it('says it again when the window changes and the new usage arrives', async () => {
    renderSection((_dir, window) => Promise.resolve(window === '7d' ? week() : month()))
    await waitFor(() => {
      expect(status().textContent).toBe('Tokens per day for the last 7 days updated')
    })

    act(() => {
      useTotalsWindowStore.getState().setWindow('30d')
    })

    await waitFor(() => {
      expect(status().textContent).toBe('Tokens per day for the last 30 days updated')
    })
  })
})
