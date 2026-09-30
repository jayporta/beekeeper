import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App', () => {
  it('has a sidebar landmark and a main landmark', () => {
    render(<App />)

    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
  })
})
