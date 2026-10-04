import { describe, expect, it } from 'vitest'
import { isProjectChange } from '../isProjectChange'

describe('isProjectChange', () => {
  it('is a change when the project in effect is another folder', () => {
    expect(isProjectChange('-Users-a-one', '-Users-a-two')).toBe(true)
  })

  it('is not a change while it is the same folder', () => {
    expect(isProjectChange('-Users-a-one', '-Users-a-one')).toBe(false)
  })

  it('is not a change when the first project loads', () => {
    expect(isProjectChange(null, '-Users-a-one')).toBe(false)
  })

  it('is not a change during a gap while projects are unavailable', () => {
    expect(isProjectChange('-Users-a-one', null)).toBe(false)
  })

  it('is not a change when no project was ever known', () => {
    expect(isProjectChange(null, null)).toBe(false)
  })
})
