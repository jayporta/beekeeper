/** How many characters of a label a row keeps when the pane's width is unknown, so its facts stay in view. */
export const MAX_LABEL_CHARS = 48

/** The least a label keeps, however narrow the pane, so a name stays recognizable. */
export const MIN_LABEL_CHARS = 12

/**
 * How many characters a row's label may take.
 *
 * @param options - The pane's body width in columns, or `undefined` when it is unknown, and how many characters the rest of the row takes (the prefix, the facts and the gaps).
 * @returns The width less what the rest takes, at least {@link MIN_LABEL_CHARS}, or {@link MAX_LABEL_CHARS} when the width is unknown.
 */
export function labelRoom(options: {
  readonly columns: number | undefined
  readonly reserved: number
}): number {
  const { columns, reserved } = options
  return columns === undefined ? MAX_LABEL_CHARS : Math.max(MIN_LABEL_CHARS, columns - reserved)
}

/**
 * Cuts a label to `max` characters, the last an ellipsis when it was cut.
 *
 * @param label - The label.
 * @param max - The most characters to keep; defaults to {@link MAX_LABEL_CHARS}.
 * @returns The label, or its start and an ellipsis.
 */
export function cutLabel(label: string, max: number = MAX_LABEL_CHARS): string {
  const chars = [...label]
  return chars.length <= max ? label : `${chars.slice(0, max - 1).join('')}…`
}
