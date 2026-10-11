/**
 * Stops a timer from keeping the process alive when the host's timer supports
 * it. Node's timers do; a host whose timers are plain numbers does nothing.
 * @param timer - A timer from `setTimeout`.
 */
export function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  if (
    typeof timer === 'object' &&
    timer !== null &&
    'unref' in timer &&
    typeof timer.unref === 'function'
  ) {
    timer.unref()
  }
}
