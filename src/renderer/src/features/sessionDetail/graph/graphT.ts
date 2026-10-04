import type { TFunction } from 'i18next'

/** The translate function the graph uses: the session detail namespace, and the sessions namespace for the notes it shares. */
export type GraphT = TFunction<['sessionDetail', 'sessions']>
