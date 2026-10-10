import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import type { OtelReceiverDto } from '../../../../../shared/ipc/otelReceiverDto'
import { installBeekeeperApi, TEST_OTEL_OFF } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { TelemetryDialog } from '../TelemetryDialog'
import { telemetryEnvLines } from '../telemetryEnvLines'
import { useOtelReceiverChanges } from '../useOtelReceiverChanges'

const TOKEN = 'tok-tok-tok-tok-tok-tok-tok-tok-tok-tok-1'
const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 23456,
  token: TOKEN
}
const ok = (value: OtelReceiverDto): Promise<{ ok: true; value: OtelReceiverDto }> =>
  Promise.resolve({ ok: true, value })

function renderDialog(onClose = vi.fn()): { onClose: () => void } {
  render(<TelemetryDialog open onClose={onClose} />, { wrapper: createQueryWrapper() })
  return { onClose }
}

const COPIED = 'Copied to clipboard.'
const COPY_FAILED = "beekeeper couldn't copy. Select the lines and copy them yourself."

const dialog = (): HTMLElement => screen.getByRole('dialog', { name: 'Claude Code telemetry' })
const checkbox = (): HTMLElement =>
  within(dialog()).getByRole('checkbox', { name: "Receive Claude Code's cost estimates" })

/** The visible status line, which the checkbox's `aria-describedby` points at. */
function statusLine(): HTMLElement {
  const line = document.getElementById(checkbox().getAttribute('aria-describedby') ?? '')
  if (line === null) throw new Error('the checkbox does not point at a status line')
  return line
}

/** Waits until the visible status line says `text`, then returns it. */
async function findStatusLine(text: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(statusLine().textContent).toBe(text)
  })
  return statusLine()
}

/**
 * The hidden polite region that announces outcomes. It is the dialog's first
 * status, ahead of the copy status, which exists only while the receiver is on.
 */
const outcomeRegion = (): HTMLElement => within(dialog()).getAllByRole('status')[0] as HTMLElement

/** Records which texts the hidden region has been given, one per announcement. */
interface AnnouncementWatch {
  /** The elements that carried text in the region, in the order they appeared. */
  readonly carriers: Set<Element>
  /** Adds what the observer has not delivered yet. */
  flush(): void
}

/**
 * Starts watching `region` for announcements. Each announcement is a new text
 * node under a new element, so the distinct elements that carried text count
 * the announcements, including one that is replaced before anyone could read it.
 */
function watchAnnouncements(region: HTMLElement): AnnouncementWatch {
  const carriers = new Set<Element>()
  const note = (records: MutationRecord[]): void => {
    for (const record of records) {
      const touched =
        record.type === 'characterData' ? [record.target] : Array.from(record.addedNodes)
      for (const node of touched) {
        const carrier = node instanceof Element ? node : node.parentElement
        if (carrier !== null && carrier !== region) carriers.add(carrier)
      }
    }
  }
  const observer = new MutationObserver(note)
  observer.observe(region, { childList: true, subtree: true, characterData: true })
  return {
    carriers,
    flush: () => {
      note(observer.takeRecords())
    }
  }
}

/** The non-empty texts announced so far, read after pending updates have settled. */
async function settledAnnouncements(watch: AnnouncementWatch): Promise<string[]> {
  await act(async () => {
    await Promise.resolve()
  })
  watch.flush()
  return [...watch.carriers].map((node) => node.textContent ?? '').filter((text) => text !== '')
}

/** Mounts the receiver-change subscription the sidebar footer provides, around the dialog. */
function DialogWithReceiverChanges(): React.JSX.Element {
  useOtelReceiverChanges()
  return <TelemetryDialog open onClose={vi.fn()} />
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TelemetryDialog', () => {
  it('shows no dialog while closed', () => {
    installBeekeeperApi()
    render(<TelemetryDialog open={false} onClose={vi.fn()} />, { wrapper: createQueryWrapper() })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows an unchecked checkbox and an off status while the receiver is off', async () => {
    installBeekeeperApi()
    renderDialog()

    expect(await findStatusLine('Off. Nothing is listening.')).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(false)
    expect(within(dialog()).queryByRole('region')).toBeNull()
  })

  it('says it is checking the setting while the receiver loads', () => {
    installBeekeeperApi({ getOtelReceiver: () => new Promise(() => undefined) })
    renderDialog()

    expect(statusLine().textContent).toBe('Checking the telemetry setting.')
    expect(checkbox().getAttribute('aria-disabled')).toBe('true')
  })

  it('turns the receiver on, then shows it listening with the lines to set', async () => {
    const api = installBeekeeperApi({ setOtelReceiverEnabled: () => ok(LISTENING) })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(api.setOtelReceiverEnabled).toHaveBeenCalledWith(true)
    expect(await findStatusLine('Listening on 127.0.0.1, port 23456.')).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(true)
    const lines = within(dialog()).getByRole('region', {
      name: 'Environment variables for Claude Code'
    })
    expect(lines.textContent).toBe(telemetryEnvLines({ port: 23456, token: TOKEN }))
  })

  it('makes the lines a keyboard-focusable region, so a long line scrolls', async () => {
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING) })
    renderDialog()

    const lines = await within(dialog()).findByRole('region', {
      name: 'Environment variables for Claude Code'
    })

    expect(lines.tabIndex).toBe(0)
  })

  it('shows the lines for a receiver that is on but failed, since the token still applies', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok({ ...LISTENING, status: 'failed', failure: 'port-in-use' })
    })
    renderDialog()

    expect(await within(dialog()).findByRole('region')).toBeTruthy()
  })

  it('turns the receiver off and hides the lines', async () => {
    const api = installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      setOtelReceiverEnabled: () => ok({ ...TEST_OTEL_OFF })
    })
    renderDialog()
    await within(dialog()).findByRole('region')

    await userEvent.click(checkbox())

    expect(api.setOtelReceiverEnabled).toHaveBeenCalledWith(false)
    expect(await findStatusLine('Off. Nothing is listening.')).toBeTruthy()
    expect(within(dialog()).queryByRole('region')).toBeNull()
  })

  it('says the port is in use when the receiver could not start', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok({ ...LISTENING, status: 'failed', failure: 'port-in-use' })
    })
    renderDialog()

    expect(
      await findStatusLine(
        'Another app is using port 23456. Turn the receiver off and on again to get a new port and token.'
      )
    ).toBeTruthy()
  })

  it('says it could not start for any other failure', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok({ ...LISTENING, status: 'failed', failure: 'failed' })
    })
    renderDialog()

    expect(
      await findStatusLine(
        "beekeeper couldn't start listening on port 23456, or stopped listening on it. Turn the receiver off and on again to get a new port and token."
      )
    ).toBeTruthy()
  })

  it.each([
    ['port-in-use', "beekeeper couldn't find a free port, so the receiver stays off."],
    ['failed', "beekeeper couldn't start the receiver, so it stays off."]
  ] as const)(
    'says the receiver stays off when turning it on failed with %s, and shows no lines',
    async (failure, message) => {
      installBeekeeperApi({
        setOtelReceiverEnabled: () => ok({ enabled: false, status: 'failed', failure })
      })
      renderDialog()
      await findStatusLine('Off. Nothing is listening.')

      await userEvent.click(checkbox())

      expect(await findStatusLine(message)).toBeTruthy()
      expect((checkbox() as HTMLInputElement).checked).toBe(false)
      expect(within(dialog()).queryByRole('region')).toBeNull()
    }
  )

  it('describes the checkbox by the status line, so focusing it reads why it stays off', async () => {
    installBeekeeperApi({
      setOtelReceiverEnabled: () => ok({ enabled: false, status: 'failed', failure: 'port-in-use' })
    })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    const reason = "beekeeper couldn't find a free port, so the receiver stays off."
    expect((await findStatusLine(reason)).textContent).toBe(reason)
  })

  it('shows the saving line in the visible status that describes the checkbox, outside any live region', async () => {
    installBeekeeperApi({ setOtelReceiverEnabled: () => new Promise(() => undefined) })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    const line = await findStatusLine('Turning the receiver on…')
    expect(line.getAttribute('role')).toBeNull()
  })

  it('announces the loaded state once when the setting finishes loading after the dialog opens', async () => {
    let finishLoad: () => void = () => undefined
    installBeekeeperApi({
      getOtelReceiver: () =>
        new Promise((resolve) => {
          finishLoad = () => {
            resolve({ ok: true, value: TEST_OTEL_OFF })
          }
        })
    })
    renderDialog()
    const announcements = watchAnnouncements(outcomeRegion())

    await act(async () => {
      finishLoad()
      await Promise.resolve()
    })

    await findStatusLine('Off. Nothing is listening.')
    expect(await settledAnnouncements(announcements)).toEqual(['Off. Nothing is listening.'])
  })

  it('announces that the setting could not be read when the load fails after the dialog opens', async () => {
    let failLoad: () => void = () => undefined
    installBeekeeperApi({
      getOtelReceiver: () =>
        new Promise((resolve) => {
          failLoad = () => {
            resolve({ ok: false, error: { code: 'untrusted-sender' } })
          }
        })
    })
    renderDialog()
    const announcements = watchAnnouncements(outcomeRegion())

    await act(async () => {
      failLoad()
      await Promise.resolve()
    })

    await findStatusLine("beekeeper couldn't read the telemetry setting.")
    expect(await settledAnnouncements(announcements)).toEqual([
      "beekeeper couldn't read the telemetry setting."
    ])
  })

  it('announces nothing for the state showing when the dialog opens', async () => {
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING) })
    const client = createTestQueryClient()
    client.setQueryData(['otelReceiver'], LISTENING)
    render(<TelemetryDialog open onClose={vi.fn()} />, { wrapper: createQueryWrapper(client) })
    const announcements = watchAnnouncements(outcomeRegion())

    await findStatusLine('Listening on 127.0.0.1, port 23456.')

    expect(await settledAnnouncements(announcements)).toEqual([])
  })

  it.each([
    [
      'a successful turn-on',
      { enabled: true, status: 'listening', failure: null, port: 23456, token: TOKEN },
      'Listening on 127.0.0.1, port 23456.'
    ],
    [
      'a failed turn-on',
      { enabled: false, status: 'failed', failure: 'port-in-use' },
      "beekeeper couldn't find a free port, so the receiver stays off."
    ]
  ] as const)(
    'announces exactly one outcome for %s, never the state it replaced',
    async (_name, outcome, text) => {
      let finishSave: () => void = () => undefined
      installBeekeeperApi({
        setOtelReceiverEnabled: () =>
          new Promise((resolve) => {
            finishSave = () => {
              resolve({ ok: true, value: outcome })
            }
          })
      })
      renderDialog()
      await findStatusLine('Off. Nothing is listening.')
      const announcements = watchAnnouncements(outcomeRegion())

      await userEvent.click(checkbox())
      // Held long enough for the state being replaced to be announced, if it were.
      await findStatusLine('Turning the receiver on…')
      await act(async () => {
        finishSave()
        await Promise.resolve()
      })

      await findStatusLine(text)
      expect(await settledAnnouncements(announcements)).toEqual([text])
    }
  )

  it('announces the new state when main reports the receiver failed while the dialog is open', async () => {
    const failed: OtelReceiverDto = { ...LISTENING, status: 'failed', failure: 'failed' }
    let reads = 0
    const api = installBeekeeperApi({
      getOtelReceiver: () => ok(++reads === 1 ? LISTENING : failed)
    })
    render(<DialogWithReceiverChanges />, { wrapper: createQueryWrapper() })
    await findStatusLine('Listening on 127.0.0.1, port 23456.')

    act(() => {
      api.fireOtelReceiverChanged()
    })

    const failure =
      "beekeeper couldn't start listening on port 23456, or stopped listening on it. Turn the receiver off and on again to get a new port and token."
    await waitFor(() => {
      expect(outcomeRegion().textContent).toBe(failure)
    })
  })

  it('announces each of two identical failed turn-ons as new text, without the saving line', async () => {
    const finishers: (() => void)[] = []
    installBeekeeperApi({
      setOtelReceiverEnabled: () =>
        new Promise((resolve) => {
          finishers.push(() => {
            resolve({
              ok: true,
              value: { enabled: false, status: 'failed', failure: 'port-in-use' }
            })
          })
        })
    })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')
    const failure = "beekeeper couldn't find a free port, so the receiver stays off."
    const heldWhileSaving: string[] = []
    const announced: Element[] = []
    let previous = outcomeRegion().firstElementChild

    for (let attempt = 0; attempt < 2; attempt++) {
      await userEvent.click(checkbox())
      heldWhileSaving.push(outcomeRegion().textContent)
      await act(async () => {
        finishers[attempt]?.()
        await Promise.resolve()
      })
      await waitFor(() => {
        expect(outcomeRegion().firstElementChild).not.toBe(previous)
        expect(outcomeRegion().textContent).toBe(failure)
      })
      previous = outcomeRegion().firstElementChild
      if (previous !== null) announced.push(previous)
    }

    expect(announced[1]).not.toBe(announced[0])
    expect(heldWhileSaving.join('|')).not.toContain('Turning')
  })

  it('says the receiver is turning off while turning it off is saving', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      setOtelReceiverEnabled: () => new Promise(() => undefined)
    })
    renderDialog()
    await within(dialog()).findByRole('region')

    await userEvent.click(checkbox())

    expect(await findStatusLine('Turning the receiver off…')).toBeTruthy()
  })

  it('forgets cached reported costs once the receiver is turned off', async () => {
    const client = createTestQueryClient()
    client.setQueryData(['reportedCost', 'session-1'], { costUsd: 1 })
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      setOtelReceiverEnabled: () => ok({ ...TEST_OTEL_OFF })
    })
    render(<TelemetryDialog open onClose={vi.fn()} />, { wrapper: createQueryWrapper(client) })
    await within(dialog()).findByRole('region')

    await userEvent.click(checkbox())

    await findStatusLine('Off. Nothing is listening.')
    expect(client.getQueryData(['reportedCost', 'session-1'])).toBeUndefined()
  })

  it('keeps cached reported costs when the receiver is turned on', async () => {
    const client = createTestQueryClient()
    client.setQueryData(['reportedCost', 'session-1'], { costUsd: 1 })
    installBeekeeperApi({ setOtelReceiverEnabled: () => ok(LISTENING) })
    render(<TelemetryDialog open onClose={vi.fn()} />, { wrapper: createQueryWrapper(client) })
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    await within(dialog()).findByRole('region')
    expect(client.getQueryData(['reportedCost', 'session-1'])).toEqual({ costUsd: 1 })
  })

  it('tells the person the port and token change each time, and to keep the lines private', async () => {
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING) })
    renderDialog()
    await within(dialog()).findByRole('region')

    expect(
      within(dialog()).getByText(/port and token change each time you turn the receiver on/)
    ).toBeTruthy()
    expect(within(dialog()).getByText(/readable only by you/)).toBeTruthy()
  })

  it('reads the receiver again after a change fails, so no stale port or token stays on screen', async () => {
    let reads = 0
    const api = installBeekeeperApi({
      getOtelReceiver: () => {
        reads += 1
        return ok(reads === 1 ? LISTENING : TEST_OTEL_OFF)
      },
      setOtelReceiverEnabled: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await within(dialog()).findByRole('region')

    await userEvent.click(checkbox())

    await waitFor(() => {
      expect(within(dialog()).queryByRole('region')).toBeNull()
    })
    expect(api.getOtelReceiver).toHaveBeenCalledTimes(2)
    expect((checkbox() as HTMLInputElement).checked).toBe(false)
  })

  it('says it could not read the setting when the receiver call fails', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => Promise.resolve({ ok: false, error: { code: 'untrusted-sender' } })
    })
    renderDialog()

    expect(await findStatusLine("beekeeper couldn't read the telemetry setting.")).toBeTruthy()
  })

  it('says it could not save the setting and leaves the checkbox as it was', async () => {
    installBeekeeperApi({
      setOtelReceiverEnabled: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(await findStatusLine("beekeeper couldn't save the telemetry setting.")).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(false)
  })

  it('marks the checkbox unavailable while a change is saving', async () => {
    installBeekeeperApi({ setOtelReceiverEnabled: () => new Promise(() => undefined) })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(checkbox().getAttribute('aria-disabled')).toBe('true')
  })

  it('ignores another click on the checkbox while a change is saving', async () => {
    const api = installBeekeeperApi({ setOtelReceiverEnabled: () => new Promise(() => undefined) })
    renderDialog()
    await findStatusLine('Off. Nothing is listening.')

    await userEvent.click(checkbox())
    await userEvent.click(checkbox())

    expect(api.setOtelReceiverEnabled).toHaveBeenCalledTimes(1)
  })

  it('ignores a click on the checkbox while the setting loads', async () => {
    const api = installBeekeeperApi({ getOtelReceiver: () => new Promise(() => undefined) })
    renderDialog()

    await userEvent.click(checkbox())

    expect(api.setOtelReceiverEnabled).not.toHaveBeenCalled()
  })

  it('copies the lines to the clipboard and says so', async () => {
    const copyText = vi.fn(() => Promise.resolve({ ok: true as const, value: null }))
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING), copyText })
    renderDialog()
    await within(dialog()).findByRole('region')

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy' }))

    expect(copyText).toHaveBeenCalledWith(telemetryEnvLines({ port: 23456, token: TOKEN }))
    expect(await within(dialog()).findByText('Copied to clipboard.')).toBeTruthy()
  })

  it('clears the copied message after a while', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () => Promise.resolve({ ok: true as const, value: null })
    })
    renderDialog()
    await within(dialog()).findByRole('region')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy' }))
    await within(dialog()).findByText('Copied to clipboard.')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_COPY_CLEAR_MS)
    })

    expect(within(dialog()).queryByText('Copied to clipboard.')).toBeNull()
  })

  it('says so when the copy fails', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await within(dialog()).findByRole('region')

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy' }))

    expect(await within(dialog()).findByText(COPY_FAILED)).toBeTruthy()
  })

  it('keeps the copy failure showing past the time a success would clear', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await within(dialog()).findByRole('region')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy' }))
    await within(dialog()).findByText(COPY_FAILED)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LIVE_COPY_CLEAR_MS * 3)
    })

    expect(within(dialog()).getByText(COPY_FAILED)).toBeTruthy()
  })

  it('forgets a copy failure when the dialog closes and opens again', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    const { rerender } = render(<TelemetryDialog open onClose={vi.fn()} />, {
      wrapper: createQueryWrapper()
    })
    await within(dialog()).findByRole('region')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Copy' }))
    await within(dialog()).findByText(COPY_FAILED)

    rerender(<TelemetryDialog open={false} onClose={vi.fn()} />)
    rerender(<TelemetryDialog open onClose={vi.fn()} />)

    await within(dialog()).findByRole('region')
    expect(within(dialog()).queryByText(COPY_FAILED)).toBeNull()
  })

  it('clears the message when Copy is pressed, then says the new outcome, so each press is announced', async () => {
    const pending: ((outcome: 'copied') => void)[] = []
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () =>
        new Promise((resolve) => {
          pending.push(() => {
            resolve({ ok: true, value: null })
          })
        })
    })
    renderDialog()
    await within(dialog()).findByRole('region')
    const copy = within(dialog()).getByRole('button', { name: 'Copy' })

    await userEvent.click(copy)
    await act(async () => {
      pending[0]?.('copied')
      await Promise.resolve()
    })
    await within(dialog()).findByText(COPIED)
    await userEvent.click(copy)

    expect(within(dialog()).queryByText(COPIED)).toBeNull()
    await act(async () => {
      pending[1]?.('copied')
      await Promise.resolve()
    })
    expect(await within(dialog()).findByText(COPIED)).toBeTruthy()
  })

  it('clears an earlier failure as soon as Copy is pressed again', async () => {
    let succeed = false
    installBeekeeperApi({
      getOtelReceiver: () => ok(LISTENING),
      copyText: () =>
        succeed
          ? new Promise(() => undefined)
          : Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await within(dialog()).findByRole('region')
    const copy = within(dialog()).getByRole('button', { name: 'Copy' })
    await userEvent.click(copy)
    await within(dialog()).findByText(COPY_FAILED)
    succeed = true

    await userEvent.click(copy)

    expect(within(dialog()).queryByText(COPY_FAILED)).toBeNull()
  })

  it('warns about sessions that started earlier and about the content flags', async () => {
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING) })
    renderDialog()
    await within(dialog()).findByRole('region')

    expect(within(dialog()).getByText(/Sessions that started before you set them/)).toBeTruthy()
    expect(within(dialog()).getByText(/Leave OTEL_LOG_USER_PROMPTS/)).toBeTruthy()
  })

  it('never writes the token into the page outside the lines', async () => {
    installBeekeeperApi({ getOtelReceiver: () => ok(LISTENING) })
    renderDialog()
    const lines = await within(dialog()).findByRole('region')

    const rest = (dialog().textContent ?? '').replace(lines.textContent ?? '', '')

    expect(rest).not.toContain(TOKEN)
  })

  it('closes with the Close button', async () => {
    installBeekeeperApi()
    const { onClose } = renderDialog()

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalled()
  })
})
