import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { OtelReceiverDto } from '../../../../../shared/ipc/otelReceiverDto'
import { installBeekeeperApi } from '@renderer/testBeekeeperApi'
import { createQueryWrapper, createTestQueryClient } from '@renderer/testQueryWrapper'
import { TelemetryFooter } from '../TelemetryFooter'

const LISTENING: OtelReceiverDto = {
  enabled: true,
  status: 'listening',
  failure: null,
  port: 47318,
  token: 'tok-tok-tok-tok-tok-tok-tok-tok-tok-tok-1'
}

/** Renders the footer and waits until the receiver's state has been read. */
async function renderFooter(): Promise<void> {
  const client = createTestQueryClient()
  render(<TelemetryFooter />, { wrapper: createQueryWrapper(client) })
  await waitFor(() => {
    expect(client.getQueryData(['otelReceiver'])).toBeDefined()
  })
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
})
