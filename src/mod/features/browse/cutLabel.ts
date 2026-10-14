/** How many characters of a session's label a Browse row keeps, so its facts stay in view on a narrow pane. */
export const MAX_LABEL_CHARS = 48

/**
 * Cuts a label to {@link MAX_LABEL_CHARS} characters, the last an ellipsis when it was cut.
 *
 * @param label - The label.
 * @returns The label, or its start and an ellipsis.
 */
export function cutLabel(label: string): string {
  const chars = [...label]
  return chars.length <= MAX_LABEL_CHARS
    ? label
    : `${chars.slice(0, MAX_LABEL_CHARS - 1).join('')}…`
}
