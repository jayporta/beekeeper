import { useEffect, useRef } from 'react'
import { useAnnouncement } from '@renderer/components/useAnnouncement'

/** What the telemetry dialog's status line says and whether a change is saving. */
export interface TelemetryAnnouncementInput {
  /** The status line without the saving text. */
  readonly message: string
  /** Whether a change is saving. */
  readonly saving: boolean
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
 * as the setting loading or the receiver failing. The saving line itself is
 * never announced, so one toggle is one announcement. The status showing when
 * the dialog opens is not announced, since the checkbox's description covers it.
 *
 * @param input - The status line without the saving text, and whether a change is saving.
 * @returns The text for the region and its announcement id.
 */
export function useTelemetryAnnouncement({
  message,
  saving
}: TelemetryAnnouncementInput): TelemetryAnnouncement {
  const { message: spoken, id, announce } = useAnnouncement()
  const previous = useRef({ message, saving })
  useEffect(() => {
    const was = previous.current
    const finishedSaving = was.saving && !saving
    const changedWhileIdle = !saving && message !== was.message
    if (finishedSaving || changedWhileIdle) announce(message)
    previous.current = { message, saving }
  }, [message, saving, announce])
  return { message: spoken, id }
}
