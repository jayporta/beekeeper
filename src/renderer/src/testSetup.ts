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

// jsdom has no scrollIntoView, which the main landmark takes on navigation.
Element.prototype.scrollIntoView = () => undefined

// jsdom has no modal dialog. This models the parts the app uses: `showModal` opens it, and `close`
// closes it and fires `close`. It doesn't model the focus trap, the top layer, or Escape.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
