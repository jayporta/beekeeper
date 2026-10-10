import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OtelReceiverDto } from '../../../../../shared/ipc/otelReceiverDto'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { TelemetryFooter } from '../TelemetryFooter'

const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 23456,
  token: 'tok-tok-tok-tok-tok-tok-tok-tok-tok-tok-1'
}

const FAILED: OtelReceiverDto = { ...LISTENING, status: 'failed', failure: 'failed' }

const LISTENING_NOTE = 'Local only · read-only · receiving Claude Code telemetry on 127.0.0.1'
const LOCAL_ONLY_NOTE = 'Local only · read-only'

/** Renders the footer and waits until the receiver's state has been read. */
async function renderFooter(): Promise<{ unmount(): void }> {
  const client = createTestQueryClient()
  const view = render(<TelemetryFooter />, { wrapper: createQueryWrapper(client) })
  await waitFor(() => {
    expect(client.getQueryData(['otelReceiver'])).toBeDefined()
  })
  return view
}

/** A `getOtelReceiver` that reports `first` once, then `later` on every call after. */
function receiverThatChanges(first: OtelReceiverDto, later: OtelReceiverDto) {
  let calls = 0
  return () => Promise.resolve({ ok: true as const, value: calls++ === 0 ? first : later })
}

describe('TelemetryFooter', () => {
  it('says beekeeper is local only and read-only while the receiver is off', async () => {
    installBeekeeperApi()
    await renderFooter()

    expect(await screen.findByText('Local only · read-only')).toBeTruthy()
  })

  it('says it is receiving telemetry on 127.0.0.1 while the receiver is listening', async () => {
    installBeekeeperApi({
      getOtelReceiver: () => Promise.resolve({ ok: true, value: LISTENING })
    })
    await renderFooter()

    expect(
      await screen.findByText(
        'Local only · read-only · receiving Claude Code telemetry on 127.0.0.1'
      )
    ).toBeTruthy()
  })

  it('keeps the local-only note when the receiver is on but could not start', async () => {
    installBeekeeperApi({
      getOtelReceiver: () =>
        Promise.resolve({
          ok: true,
          value: { ...LISTENING, status: 'failed', failure: 'port-in-use' }
        })
    })
    await renderFooter()

    expect(await screen.findByText('Local only · read-only')).toBeTruthy()
  })

  it('opens the telemetry dialog from its button', async () => {
    installBeekeeperApi()
    await renderFooter()

    await userEvent.click(screen.getByRole('button', { name: 'Claude Code telemetry' }))

    expect(screen.getByRole('dialog', { name: 'Claude Code telemetry' })).toBeTruthy()
  })

  it('closes the dialog and puts focus back on the button', async () => {
    installBeekeeperApi()
    await renderFooter()
    const button = screen.getByRole('button', { name: 'Claude Code telemetry' })
    await userEvent.click(button)

    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('reads the receiver once however often the dialog is opened', async () => {
    const api = installBeekeeperApi()
    await renderFooter()
    const button = screen.getByRole('button', { name: 'Claude Code telemetry' })

    await userEvent.click(button)
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    await userEvent.click(button)
    await within(screen.getByRole('dialog')).findByText('Off. Nothing is listening.')

    expect(api.getOtelReceiver).toHaveBeenCalledTimes(1)
  })

  describe('when main reports the receiver changed on its own', () => {
    it('stops saying it is receiving once the receiver failed', async () => {
      const api = installBeekeeperApi({ getOtelReceiver: receiverThatChanges(LISTENING, FAILED) })
      await renderFooter()
      await screen.findByText(LISTENING_NOTE)

      act(() => {
        api.fireOtelReceiverChanged()
      })

      expect(await screen.findByText(LOCAL_ONLY_NOTE)).toBeTruthy()
    })

    it('reads the receiver again for a change reported before the footer mounted', async () => {
      const api = installBeekeeperApi({
        getOtelReceiver: () => Promise.resolve({ ok: true, value: FAILED })
      })
      const client = createTestQueryClient()
      client.setQueryData(['otelReceiver'], LISTENING)
      api.fireOtelReceiverChanged()

      render(<TelemetryFooter />, { wrapper: createQueryWrapper(client) })

      expect(await screen.findByText(LOCAL_ONLY_NOTE)).toBeTruthy()
    })

    it('removes its subscription once unmounted', async () => {
      const unsubscribe = vi.fn()
      installBeekeeperApi({ onOtelReceiverChanged: () => unsubscribe })
      const view = await renderFooter()

      view.unmount()

      expect(unsubscribe).toHaveBeenCalledTimes(1)
    })
  })
})
