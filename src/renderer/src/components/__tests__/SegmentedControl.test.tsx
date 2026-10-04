import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from '../SegmentedControl'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' }
] as const

// jsdom has no CSS.escape, which user-event needs to find the radios of a group.
beforeAll(() => {
  Object.defineProperty(globalThis, 'CSS', {
    configurable: true,
    value: { escape: (text: string) => text.replaceAll(/[^\w-]/g, (char) => `\\${char}`) }
  })
})

function Harness({ onChange }: { onChange?: (value: string) => void }): React.JSX.Element {
  const [value, setValue] = useState<string>('a')
  return (
    <>
      <button type="button">before</button>
      <SegmentedControl
        label="Letters"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
      <button type="button">after</button>
    </>
  )
}

describe('SegmentedControl', () => {
  it('is a named radio group with one radio per option', () => {
    render(<Harness />)

    const group = screen.getByRole('radiogroup', { name: 'Letters' })
    expect(group).toBeTruthy()
    expect(
      screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)
    ).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('checks only the selected option', () => {
    render(<Harness />)

    expect(
      (screen.getAllByRole('radio') as HTMLInputElement[]).map((radio) => radio.checked)
    ).toEqual([true, false, false])
  })

  it('reports the option that is clicked', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Beta' }))

    expect(onChange).toHaveBeenCalledWith('b')
    expect((screen.getByRole('radio', { name: 'Beta' }) as HTMLInputElement).checked).toBe(true)
  })

  it('has one tab stop: Tab moves in on the selected option and out past the group', async () => {
    render(<Harness />)
    await userEvent.click(screen.getByRole('button', { name: 'before' }))

    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Alpha' }))

    await userEvent.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'after' }))
  })

  it('moves to and selects the next option with the arrow key', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    screen.getByRole('radio', { name: 'Alpha' }).focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenLastCalledWith('b')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Beta' }))
  })

  it('wraps from the last option to the first', async () => {
    render(<Harness />)
    screen.getByRole('radio', { name: 'Alpha' }).focus()

    await userEvent.keyboard('{ArrowLeft}')

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Gamma' }))
  })
})
