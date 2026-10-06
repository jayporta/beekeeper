import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { idbStorage } from '@renderer/storage/idbStorage'
import { useFirstRunStore } from '../state/useFirstRunStore'

let write: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  write = vi.spyOn(idbStorage, 'setItem').mockResolvedValue(undefined)
  useFirstRunStore.setState({ dismissed: false })
  write.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useFirstRunStore dismiss', () => {
  it('marks the screen dismissed and saves it', () => {
    useFirstRunStore.getState().dismiss()

    expect(useFirstRunStore.getState().dismissed).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('does not write to storage again when it is already dismissed', () => {
    useFirstRunStore.getState().dismiss()

    useFirstRunStore.getState().dismiss()
    useFirstRunStore.getState().dismiss()

    expect(useFirstRunStore.getState().dismissed).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('does not write when the stored dismissal was already loaded', () => {
    useFirstRunStore.setState({ dismissed: true })
    write.mockClear()

    useFirstRunStore.getState().dismiss()

    expect(write).not.toHaveBeenCalled()
  })
})
