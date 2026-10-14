import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ModalDialog } from '@renderer/components/ModalDialog'
import { isModalDialogOpen } from '../isModalDialogOpen'

/** A modal dialog, open or closed. */
function dialog(open: boolean): React.JSX.Element {
  return (
    <ModalDialog open={open} onClose={() => undefined} labelledBy="heading">
      <h2 id="heading">Dialog</h2>
    </ModalDialog>
  )
}

describe('isModalDialogOpen', () => {
  it('is false with no dialog on the page', () => {
    expect(isModalDialogOpen()).toBe(false)
  })

  it('is false for a dialog that is mounted but closed', () => {
    render(dialog(false))

    expect(isModalDialogOpen()).toBe(false)
  })

  it('is true while a modal dialog is open', () => {
    render(dialog(true))

    expect(isModalDialogOpen()).toBe(true)
  })

  it('is false again once the dialog closes', () => {
    const { rerender } = render(dialog(true))

    rerender(dialog(false))

    expect(isModalDialogOpen()).toBe(false)
  })
})
