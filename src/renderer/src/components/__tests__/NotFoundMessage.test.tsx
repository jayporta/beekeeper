import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { MAIN_HEADING_ID } from '../mainHeading'
import { NotFoundMessage } from '../NotFoundMessage'

describe('NotFoundMessage', () => {
  it('is a group named by its heading and described by its body, never a live region', () => {
    render(
      <NotFoundMessage
        heading="Gone"
        headingLevel={2}
        body="It was deleted."
        groupRef={createRef()}
        announce={false}
      />
    )

    const group = screen.getByRole('group', { name: 'Gone', description: 'It was deleted.' })
    expect(group.getAttribute('role')).toBe('group')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names the group by the main heading when the heading is a level 1', () => {
    render(
      <NotFoundMessage
        heading="Gone"
        headingLevel={1}
        body="It was deleted."
        groupRef={createRef()}
        announce={false}
      />
    )

    expect(screen.getByRole('group', { name: 'Gone' }).getAttribute('aria-labelledby')).toBe(
      MAIN_HEADING_ID
    )
  })

  it('hands its element to the ref, as a focus target', () => {
    const ref = createRef<HTMLDivElement>()
    render(
      <NotFoundMessage
        heading="Gone"
        headingLevel={2}
        body="Why."
        groupRef={ref}
        announce={false}
      />
    )

    expect(ref.current).toBe(screen.getByRole('group'))
    expect(ref.current?.getAttribute('tabindex')).toBe('-1')
  })

  it('adds a hidden alert with the same text when asked to announce', () => {
    render(
      <NotFoundMessage
        heading="Gone"
        headingLevel={2}
        body="Why."
        groupRef={createRef()}
        announce
      />
    )

    expect(screen.getByRole('alert').textContent).toBe('GoneWhy.')
  })

  it('renders its children under the body', () => {
    render(
      <NotFoundMessage
        heading="Gone"
        headingLevel={2}
        body="Why."
        groupRef={createRef()}
        announce={false}
      >
        <button type="button">Back</button>
      </NotFoundMessage>
    )

    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()
  })
})
