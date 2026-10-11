import { describe, expect, it, vi } from 'vitest'
import { unrefTimer } from '../unrefTimer'

describe('unrefTimer', () => {
  it('calls unref on a timer that has one', () => {
    const unref = vi.fn()
    unrefTimer({ unref } as unknown as ReturnType<typeof setTimeout>)
    expect(unref).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a numeric timer id', () => {
    expect(() => unrefTimer(7 as unknown as ReturnType<typeof setTimeout>)).not.toThrow()
  })

  it('does nothing for an object without unref', () => {
    expect(() => unrefTimer({} as unknown as ReturnType<typeof setTimeout>)).not.toThrow()
  })

  it('unrefs a real Node timer', () => {
    const timer = setTimeout(() => undefined, 60_000)
    expect(() => unrefTimer(timer)).not.toThrow()
    expect(timer.hasRef()).toBe(false)
    clearTimeout(timer)
  })
})
