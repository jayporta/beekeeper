import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { isDevServerUrl, isInsideRendererRoot } from '../security/requestAllowlist'

/** The parts of an Electron `IpcMainInvokeEvent` that sender validation reads. */
export interface SenderEvent {
  /** The frame that sent the message, or `null` when it is gone. */
  readonly senderFrame: {
    /** The frame's URL. */
    readonly url: string
    /** The frame's parent, or `null` for the main frame. */
    readonly parent: unknown
  } | null
}

/** Where the app's own page may be loaded from. */
export interface TrustedOrigins {
  /** Absolute path to the built renderer output directory. */
  readonly rendererRoot: string
  /** The Vite dev server's origin in development, or `undefined` in production. */
  readonly devServerUrl: string | undefined
}

function isBundledIndexUrl(url: string, rendererRoot: string): boolean {
  if (!url.startsWith('file:') || !isInsideRendererRoot(url, rendererRoot)) return false
  try {
    return fileURLToPath(url) === join(rendererRoot, 'index.html')
  } catch {
    return false
  }
}

/**
 * Decides whether an IPC message came from the app's own page.
 *
 * @remarks
 * The sender must be a main frame (a subframe, even of our own page, is
 * refused) whose URL is the bundled `index.html` or, in development, the
 * dev server's origin.
 *
 * @param event - The invoke event, or the part of it that identifies the sender.
 * @param origins - Where the app's own page may load from.
 * @returns `true` when the sender is trusted.
 */
export function isTrustedSender(event: SenderEvent, origins: TrustedOrigins): boolean {
  const frame = event.senderFrame
  if (frame === null || frame.parent !== null) return false
  return (
    isBundledIndexUrl(frame.url, origins.rendererRoot) ||
    isDevServerUrl(frame.url, origins.devServerUrl)
  )
}
