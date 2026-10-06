/** A relay for a payload-free signal, as {@link createSignalRelay} builds it. */
export interface SignalRelay {
  /** Passes one signal on: to every subscribed listener, or to the first one to subscribe if none is. */
  signal(): void
  /**
   * Subscribes a listener.
   * @param listener - Called with no arguments for each signal. When a signal arrived while no one was subscribed, it is called once at once.
   * @returns A function that removes this subscription and no other.
   */
  subscribe(listener: () => void): () => void
}

/**
 * Relays a signal that has no payload from a source that starts before its
 * listeners do. The source registers once and calls `signal`. A signal that
 * finds no listener is remembered as one pending request, so the first listener
 * to subscribe still gets it, once. Several early signals count as one.
 *
 * @returns The relay.
 * @example
 * const relay = createSignalRelay()
 * ipcRenderer.on('beekeeper:open-about', () => relay.signal())
 * const unsubscribe = relay.subscribe(() => openDialog())
 */
export function createSignalRelay(): SignalRelay {
  // Each subscription is its own object, so one function subscribed twice stays two.
  const subscriptions = new Set<{ readonly listener: () => void }>()
  let pending = false

  return {
    signal() {
      if (subscriptions.size === 0) {
        pending = true
        return
      }
      for (const { listener } of [...subscriptions]) listener()
    },
    subscribe(listener) {
      const subscription = { listener }
      subscriptions.add(subscription)
      if (pending) {
        pending = false
        listener()
      }
      return () => {
        subscriptions.delete(subscription)
      }
    }
  }
}
