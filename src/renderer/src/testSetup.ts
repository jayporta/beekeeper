import 'fake-indexeddb/auto'
import '@renderer/i18n/i18n'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom has no pointer capture, which a drag on the graph takes.
Element.prototype.setPointerCapture = () => undefined
Element.prototype.releasePointerCapture = () => undefined
