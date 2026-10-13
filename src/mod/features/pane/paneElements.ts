/** A drawn node: an element an engine constructor built, or plain text. */
type DrawnNode = object | string

/** The engine elements the pane draws with, as `$.ui.resolve(e)` hands them out. */
export interface PaneElements {
  /** A layout box. */
  Box: (props: {
    key?: string
    flexDirection?: 'row' | 'column'
    children?: DrawnNode | DrawnNode[]
  }) => object
  /** A run of text, which may nest more text. */
  Text: (props: {
    dimColor?: boolean
    bold?: boolean
    wrap?: 'wrap' | 'truncate-start' | 'truncate-end'
    children?: DrawnNode | DrawnNode[]
  }) => object
  /** A pressable row. `key` is its address. */
  Button: (props: {
    key: string
    onPress: () => void | Promise<void>
    children?: DrawnNode | DrawnNode[]
  }) => object
}
