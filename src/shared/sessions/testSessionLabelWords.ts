import type { SessionLabelWords } from './sessionLabel'

/** English session label words, for tests of the shared session code. */
export const testSessionLabelWords: SessionLabelWords = {
  unreadable: 'Unreadable session',
  untitled: 'Untitled session',
  agentName: (name, type) => `${name} (${type})`
}
