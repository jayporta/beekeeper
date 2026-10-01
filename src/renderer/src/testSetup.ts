import 'fake-indexeddb/auto'
import '@renderer/i18n/i18n'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
