import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LIVE_COPY_CLEAR_MS } from '@renderer/components/liveCopyClearMs'
import type { OtelReceiverDto } from '../../../../../shared/ipc/otelReceiverDto'
import { installBeekeeperApi, TEST_OTEL_OFF } from '@renderer/testBeekeeperApi'
import { createQueryWrapper } from '@renderer/testQueryWrapper'
import { TelemetryDialog } from '../TelemetryDialog'
import { telemetryEnvLines } from '../telemetryEnvLines'

const TOKEN = 'tok-tok-tok-tok-tok-tok-tok-tok-tok-tok-1'
const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 47318,
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

    expect(await within(dialog()).findByText('Off. Nothing is listening.')).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(false)
    expect(within(dialog()).queryByRole('region')).toBeNull()
  })

  it('says it is checking the setting while the receiver loads', () => {
    installBeekeeperApi({ getOtelReceiver: () => new Promise(() => undefined) })
    renderDialog()

    expect(within(dialog()).getByText('Checking the telemetry setting.')).toBeTruthy()
    expect(checkbox().getAttribute('aria-disabled')).toBe('true')
  })

  it('turns the receiver on, then shows it listening with the lines to set', async () => {
    const api = installBeekeeperApi({ setOtelReceiverEnabled: () => ok(LISTENING) })
    renderDialog()
    await within(dialog()).findByText('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(api.setOtelReceiverEnabled).toHaveBeenCalledWith(true)
    expect(await within(dialog()).findByText('Listening on 127.0.0.1, port 47318.')).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(true)
    const lines = within(dialog()).getByRole('region', {
      name: 'Environment variables for Claude Code'
    })
    expect(lines.textContent).toBe(telemetryEnvLines({ port: 47318, token: TOKEN }))
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
    expect(await within(dialog()).findByText('Off. Nothing is listening.')).toBeTruthy()
    expect(within(dialog()).queryByRole('region')).toBeNull()
  })

  it('says the port is in use when the receiver could not start', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok({ ...LISTENING, status: 'failed', failure: 'port-in-use' })
    })
    renderDialog()

    expect(
      await within(dialog()).findByText(
        'Port 47318 is in use. Another beekeeper window or app may be using it.'
      )
    ).toBeTruthy()
  })

  it('says it could not start for any other failure', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => ok({ ...LISTENING, status: 'failed', failure: 'failed' })
    })
    renderDialog()

    expect(
      await within(dialog()).findByText("beekeeper couldn't start listening on port 47318.")
    ).toBeTruthy()
  })

  it('says it could not read the setting when the receiver call fails', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => Promise.resolve({ ok: false, error: { code: 'untrusted-sender' } })
    })
    renderDialog()

    expect(
      await within(dialog()).findByText("beekeeper couldn't read the telemetry setting.")
    ).toBeTruthy()
  })

  it('says it could not save the setting and leaves the checkbox as it was', async () => {
    installBeekeeperApi({
      setOtelReceiverEnabled: () => Promise.resolve({ ok: false, error: { code: 'internal' } })
    })
    renderDialog()
    await within(dialog()).findByText('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(
      await within(dialog()).findByText("beekeeper couldn't save the telemetry setting.")
    ).toBeTruthy()
    expect((checkbox() as HTMLInputElement).checked).toBe(false)
  })

  it('marks the checkbox unavailable while a change is saving', async () => {
    installBeekeeperApi({ setOtelReceiverEnabled: () => new Promise(() => undefined) })
    renderDialog()
    await within(dialog()).findByText('Off. Nothing is listening.')

    await userEvent.click(checkbox())

    expect(checkbox().getAttribute('aria-disabled')).toBe('true')
  })

  it('keeps focus on the checkbox through a save', async () => {
    let finish: (value: OtelReceiverDto) => void = () => undefined
    installBeekeeperApi({
      setOtelReceiverEnabled: () =>
        new Promise((resolve) => {
          finish = (value) => {
            resolve({ ok: true, value })
          }
        })
    })
    renderDialog()
    await within(dialog()).findByText('Off. Nothing is listening.')

    await userEvent.click(checkbox())
    expect(document.activeElement).toBe(checkbox())
    await act(async () => {
      finish(LISTENING)
      await Promise.resolve()
    })

    await within(dialog()).findByText('Listening on 127.0.0.1, port 47318.')
    expect(document.activeElement).toBe(checkbox())
  })

  it('ignores another click on the checkbox while a change is saving', async () => {
    const api = installBeekeeperApi({ setOtelReceiverEnabled: () => new Promise(() => undefined) })
    renderDialog()
    await within(dialog()).findByText('Off. Nothing is listening.')

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

    expect(copyText).toHaveBeenCalledWith(telemetryEnvLines({ port: 47318, token: TOKEN }))
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
