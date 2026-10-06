import { vi } from 'vitest'
import { FILL_LAYOUT_QUERY } from './useFillLayout'

/** A stubbed `matchMedia` for the fill layout's query. */
interface FillLayoutStub {
  /** Sets whether the query matches, and tells whoever listens for the change. */
  readonly set: (matches: boolean) => void
}

/**
 * Makes `window.matchMedia` answer for the fill layout's query: whether it
 * matches now, and a `change` event on every {@link FillLayoutStub.set}. Other
 * queries match nothing. `vi.restoreAllMocks()` undoes it.
 *
 * @param matches - Whether the query matches at first.
 * @returns The handle that changes the answer.
 */
export function stubFillLayout(matches: boolean): FillLayoutStub {
  let current = matches
  const listeners = new Set<() => void>()
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        get matches() {
          return query === FILL_LAYOUT_QUERY && current
        },
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
      }) as unknown as MediaQueryList
  )
  return {
    set: (next) => {
      current = next
      for (const listener of listeners) listener()
    }
  }
}
