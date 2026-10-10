import { act, configure, getConfig } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { ANNOUNCE_PAUSE_MS } from './useAnnouncementAfterPause'

/**
 * Lets `waitFor` and `findBy*` in the calling test file wait past the pause a
 * match count holds for before the region shows it, on top of their usual
 * timeout. Call it at the top level of the file.
 */
export function allowForAnnouncePause(): void {
  let usual = getConfig().asyncUtilTimeout
  beforeEach(() => {
    usual = getConfig().asyncUtilTimeout
    configure({ asyncUtilTimeout: usual + ANNOUNCE_PAUSE_MS })
  })
  afterEach(() => {
    configure({ asyncUtilTimeout: usual })
  })
}

/** Waits past the pause, so a match count that should not be announced would have shown. */
export async function waitPastAnnouncePause(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ANNOUNCE_PAUSE_MS + 50))
  })
}
