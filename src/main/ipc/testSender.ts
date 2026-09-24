import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { TrustedOrigins } from './senderValidation'

/** A fake built renderer directory. */
export const TEST_RENDERER_ROOT = join('/app', 'out', 'renderer')
/** The `file:` URL of the fake bundled `index.html`. */
export const TEST_INDEX_URL = pathToFileURL(join(TEST_RENDERER_ROOT, 'index.html')).href
/** Production origins for the fake renderer directory: no dev server. */
export const TEST_ORIGINS: TrustedOrigins = {
  rendererRoot: TEST_RENDERER_ROOT,
  devServerUrl: undefined
}
