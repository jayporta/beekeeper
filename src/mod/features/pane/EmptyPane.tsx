import { t } from '../../i18n/modI18n'

/** A drawn node: an element an engine constructor built, or plain text. */
type PaneNode = object | string

/** The two engine elements the empty pane draws, as `$.ui.resolve(e)` hands them out. */
export interface PaneElements {
  /** A layout box. */
  Box: (props: { flexDirection?: 'row' | 'column'; children?: PaneNode | PaneNode[] }) => object
  /** A run of text. */
  Text: (props: { children?: string }) => object
}

/**
 * The pane's tree before any content exists: its title, which the engine omits while only one pane
 * is open, then one line saying there is nothing yet.
 *
 * @param elements - The engine's `Box` and `Text` for the surface being drawn.
 * @returns The tree the `ui.render` hook returns.
 * @example
 * on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => EmptyPane($.ui.resolve(e)))
 */
export function EmptyPane({ Box, Text }: PaneElements): object {
  return (
    <Box flexDirection="column">
      <Text>{t('pane.title')}</Text>
      <Text>{t('pane.empty')}</Text>
    </Box>
  )
}
