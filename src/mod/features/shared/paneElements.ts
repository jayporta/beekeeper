import type { Elements } from 'claude-code'

/** The engine elements the pane draws with, as `$.ui.resolve(e)` hands them out. */
export type PaneElements = Pick<Elements, 'Box' | 'Text' | 'Button' | 'Select'>
