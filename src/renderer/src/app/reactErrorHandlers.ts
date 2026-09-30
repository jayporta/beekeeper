/**
 * The `createRoot` error options. React's defaults log each error's full
 * message and stack, which can hold transcript content, so these log one fixed
 * message per kind and nothing from the error.
 */
export const reactErrorHandlers = {
  /** An error an error boundary caught. */
  onCaughtError(): void {
    console.error('Beekeeper caught an error while rendering.')
  },
  /** An error no error boundary caught. */
  onUncaughtError(): void {
    console.error('Beekeeper hit an uncaught error while rendering.')
  },
  /** An error React recovered from by rendering again. */
  onRecoverableError(): void {
    console.error('Beekeeper recovered from an error while rendering.')
  }
}
