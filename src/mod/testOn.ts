import type { Engine, Next, On } from 'claude-code'

/** A hook as the recording `on` stores it, with the event and input loosened so one test can drive any hook. */
export type RecordedHook = ($: Engine, e: Readonly<object>, next: Next<object, unknown>) => unknown

/** One registration the recording `on` saw. */
export interface Registered {
  /** The event name, such as `session.start`. */
  readonly event: string
  /** The matcher passed between the event and the hook, or undefined. */
  readonly matcher: unknown
  /** The hook. */
  readonly hook: RecordedHook
  /** The handler passed to `.catch`, once the module has set one. */
  catchHandler?: RecordedHook
}

/**
 * Builds an `on` that records each registration, and the handler given to its `.catch`, instead of
 * adding a hook to an engine.
 *
 * @returns The `on` to hand to `register`, and the registrations it collects.
 */
export function recordingOn(): { on: On; registered: Registered[] } {
  const registered: Registered[] = []
  const record = (
    event: string,
    ...rest: unknown[]
  ): { catch: (handler: RecordedHook) => void } => {
    const entry: Registered = {
      event,
      matcher: rest.length > 1 ? rest[0] : undefined,
      hook: rest.at(-1) as RecordedHook
    }
    registered.push(entry)
    return {
      catch: (handler) => {
        entry.catchHandler = handler
      }
    }
  }
  return { on: record as unknown as On, registered }
}
