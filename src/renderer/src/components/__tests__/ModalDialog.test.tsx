import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ModalDialog } from '../ModalDialog'

function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
        }}
      >
        Open it
      </button>
      <ModalDialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        labelledBy="heading"
      >
        <h2 id="heading">Details</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
          }}
        >
          Close it
        </button>
      </ModalDialog>
    </>
  )
}

describe('ModalDialog', () => {
  it('is closed, with nothing in it, until it is opened', () => {
    render(<Harness />)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Details')).toBeNull()
  })

  it('opens as a modal dialog named by its heading', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy()
  })

  it('closes when the parent closes it, and returns focus to what opened it', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    await userEvent.click(opener)

    await userEvent.click(screen.getByRole('button', { name: 'Close it' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('closes on Escape, which the browser sends as a cancel event, and returns focus', async () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    await userEvent.click(opener)

    const notCancelled = fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true, bubbles: false })
    )

    expect(notCancelled).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('opens again after it was closed', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close it' }))

    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))

    expect(screen.getByRole('dialog', { name: 'Details' })).toBeTruthy()
  })
})
