/** How often the pane refreshes without listing the folder's sessions, in milliseconds. */
export const PLAIN_TICK_MS = 10_000

/** How often the pane refreshes with the folder's sessions, when the session has a team, in milliseconds. */
export const LIST_TICK_MS = 30_000

/** A running timer. */
interface SchedulerTimer {
  /** Stops it. */
  readonly cancel: () => void
}

/** What the scheduler needs from the engine and the mod, as closures so it runs without either. */
export interface PaneSchedulerDeps {
  /** Calls `fn` once after `ms` milliseconds. */
  readonly after: (ms: number, fn: () => void) => SchedulerTimer
  /** Calls `fn` every `ms` milliseconds until cancelled. */
  readonly every: (ms: number, fn: () => void) => SchedulerTimer
  /** Whether the pane is open. May reject. */
  readonly isPaneOpen: () => Promise<boolean>
  /** Whether the session has teammates or is one, so the list tick has work to do. */
  readonly wantsListTick: () => boolean
  /** Runs one refresh. Its rejection is dropped: the caller records failures itself. */
  readonly refresh: (request: { readonly withList: boolean }) => Promise<void>
}

/** What decides when the pane refreshes. */
export interface PaneScheduler {
  /** Refreshes now, or queues one behind the refresh in flight. A queued list refresh wins over a plain one. */
  readonly refreshNow: (withList: boolean) => Promise<void>
  /** Refreshes after `delayMs`. Requests made while a timer is pending share it, and any that wants the list makes it a list refresh. */
  readonly schedule: (request: { readonly withList: boolean; readonly delayMs: number }) => void
  /** Starts the ticks unless they are running. */
  readonly ensureTicks: () => void
  /** Cancels the ticks. */
  readonly stopTicks: () => void
}

/** A refresh waiting for its timer. */
interface PendingTimer {
  readonly delayMs: number
  readonly timer: SchedulerTimer
  withList: boolean
}

/**
 * Builds the pane's scheduler: one refresh in flight with at most one queued,
 * a coalescing debounce, and two ticks that stop themselves once the pane
 * closes. It holds timers, so build one per loaded copy of the mod.
 *
 * @param deps - The engine and mod closures it works through.
 * @returns The scheduler.
 */
export function createPaneScheduler(deps: PaneSchedulerDeps): PaneScheduler {
  let inFlight = false
  let queued: { withList: boolean } | null = null
  let pending: PendingTimer | null = null
  let ticks: readonly SchedulerTimer[] = []

  async function refreshNow(withList: boolean): Promise<void> {
    if (inFlight) {
      queued = { withList: withList || (queued?.withList ?? false) }
      return
    }
    inFlight = true
    try {
      await deps.refresh({ withList })
    } catch {
      // The refresh records its own failure; the scheduler only has to keep going.
    } finally {
      inFlight = false
    }
    if (queued !== null) {
      const next = queued
      queued = null
      await refreshNow(next.withList)
    }
  }

  function schedule(request: { readonly withList: boolean; readonly delayMs: number }): void {
    const { withList, delayMs } = request
    if (pending !== null && delayMs >= pending.delayMs) {
      pending.withList ||= withList
      return
    }
    pending?.timer.cancel()
    const fresh: PendingTimer = {
      delayMs,
      withList: withList || (pending?.withList ?? false),
      timer: deps.after(delayMs, () => {
        if (pending === fresh) pending = null
        void refreshNow(fresh.withList)
      })
    }
    pending = fresh
  }

  function stopTicks(): void {
    for (const tick of ticks) tick.cancel()
    ticks = []
  }

  function onTick(withList: boolean): void {
    void (async () => {
      let isOpen: boolean
      try {
        isOpen = await deps.isPaneOpen()
      } catch {
        return
      }
      if (!isOpen) {
        stopTicks()
        return
      }
      if (withList && !deps.wantsListTick()) return
      await refreshNow(withList)
    })()
  }

  function ensureTicks(): void {
    if (ticks.length > 0) return
    ticks = [
      deps.every(PLAIN_TICK_MS, () => onTick(false)),
      deps.every(LIST_TICK_MS, () => onTick(true))
    ]
  }

  return { refreshNow, schedule, ensureTicks, stopTicks }
}
