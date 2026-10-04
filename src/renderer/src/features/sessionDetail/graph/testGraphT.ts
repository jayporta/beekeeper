import { i18n } from '@renderer/i18n/i18n'

const NAMESPACES: ['sessionDetail', 'sessions'] = ['sessionDetail', 'sessions']

/** The graph translate function pinned to `en-US`, so formatting does not follow the machine's locale. */
export const testGraphT = i18n.getFixedT('en-US', NAMESPACES)
