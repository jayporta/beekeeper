import { useEffect, useRef } from 'react'
import { useAnnouncement } from '@renderer/components/useAnnouncement'

/** What the telemetry dialog's status line says and how it stands. */
export interface TelemetryAnnouncementInput {
  /** The status line without the saving text. */
  readonly message: string
  /** Whether a change is saving. */
  readonly saving: boolean
  /** Whether the setting has loaded or failed to, so `message` no longer says it is loading. */
  readonly settled: boolean
}

/** What the telemetry dialog's hidden status region shows. */
export interface TelemetryAnnouncement {
  /** The text for the region. It empties after the hidden live copy's clear delay. */
  readonly message: string
  /** The announcement id. Key the text by it so an identical outcome is a new node. */
  readonly id: number
}

/**
 * What the telemetry dialog's hidden status region announces: the status line
 * once a change finishes saving, every time, even when it matches the last
 * outcome, and the status line when it changes while nothing is saving, such
 * as the receiver failing. The saving line itself is never announced, so one
 * toggle is one announcement. Neither the status showing when the dialog opens
 * nor the first move out of loading is announced, since the checkbox's
 * description already covers them.
 *
 * @param input - The status line without the saving text, whether a change is saving, and whether the setting has settled.
 * @returns The text for the region and its announcement id.
 */
export function useTelemetryAnnouncement({
  message,
  saving,
  settled
}: TelemetryAnnouncementInput): TelemetryAnnouncement {
  const { message: spoken, id, announce } = useAnnouncement()
  const previous = useRef({ message, saving, settled })
  useEffect(() => {
    const was = previous.current
    const finishedSaving = was.saving && !saving
    const changedWhileSettled = !saving && was.settled && settled && message !== was.message
    if (finishedSaving || changedWhileSettled) announce(message)
    previous.current = { message, saving, settled }
  }, [message, saving, settled, announce])
  return { message: spoken, id }
}
