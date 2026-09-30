/**
 * The content of a table cell with no value: a dash for sighted readers and
 * "not recorded" for assistive technology.
 *
 * @example
 * <td><EmptyCell /></td>
 */
export function EmptyCell(): React.JSX.Element {
  return (
    <>
      <span aria-hidden="true">-</span>
      <span className="visuallyHidden">not recorded</span>
    </>
  )
}
