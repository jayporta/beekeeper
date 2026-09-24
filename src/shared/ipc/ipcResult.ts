/**
 * Why an IPC call failed. Only these codes cross the bridge, never an error
 * message, because messages can hold file paths and transcript text.
 */
export type IpcErrorCode =
  'invalid-request' | 'untrusted-sender' | 'not-found' | 'unreadable' | 'internal'

/** The error half of an {@link IpcResult}. */
export interface IpcError {
  /** Why the call failed. */
  readonly code: IpcErrorCode
}

/** What every IPC call resolves to. Callers must check `ok` first. */
export type IpcResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: IpcError }
