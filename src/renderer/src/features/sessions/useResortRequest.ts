import { useCallback, useState } from 'react'

/** What {@link useResortRequest} needs to know about the open folder's list. */
export interface ResortRequestOptions {
  /** Whether the cached list is stale. */
  readonly isStale: boolean
  /** When the cached list loaded, in epoch milliseconds, or 0 when none has. */
  readonly dataUpdatedAt: number
}

/** A folder's pending resort request, as {@link useResortRequest} returns it. */
export interface ResortRequest {
  /** When a resort was requested, in epoch milliseconds, or 0 for none. */
  readonly resortAt: number
  /** Asks for a resort now, as a Refresh press does. */
  readonly requestResort: () => void
}

/** The request a folder opens with: the first list loaded after a stale one, or none. */
const openingRequest = ({ isStale, dataUpdatedAt }: ResortRequestOptions): number =>
  isStale ? dataUpdatedAt + 1 : 0

/**
 * Tracks when the open folder's session cards should sort again. Opening a
 * folder whose list is stale requests one for the list that replaces it,
 * since that list is refetched at once and what the person first sees should
 * be current. Switching to another folder starts over for it.
 *
 * @param dirName - The open folder.
 * @param options - Whether its cached list is stale, and when that list loaded.
 * @returns The pending request and the function that makes a new one.
 */
export function useResortRequest(dirName: string, options: ResortRequestOptions): ResortRequest {
  const [request, setRequest] = useState(() => ({ dirName, at: openingRequest(options) }))
  let current = request
  if (request.dirName !== dirName) {
    current = { dirName, at: openingRequest(options) }
    // Adjusting state while rendering: React re-renders at once with the new folder's request.
    setRequest(current)
  }
  const requestResort = useCallback(() => {
    setRequest({ dirName, at: Date.now() })
  }, [dirName])
  return { resortAt: current.at, requestResort }
}
