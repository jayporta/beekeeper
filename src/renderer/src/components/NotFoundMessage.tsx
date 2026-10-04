import { useId, type RefObject } from 'react'
import { MAIN_HEADING_ID } from './mainHeading'
import { StatusMessage } from './StatusMessage'

/** Props for {@link NotFoundMessage}. */
interface NotFoundMessageProps {
  /** The message's heading. */
  readonly heading: string
  /** The heading level, as {@link StatusMessage} takes it. */
  readonly headingLevel: 1 | 2
  /** The explanation under the heading. */
  readonly body: string
  /** Receives the message's element, so `useFocusOrAnnounce` can focus it. */
  readonly groupRef: RefObject<HTMLDivElement | null>
  /** Whether to add the hidden alert that announces the message, from `useFocusOrAnnounce`. */
  readonly announce: boolean
  /** An action shown under the body, such as a way back. */
  readonly children?: React.ReactNode
}

/**
 * A "not found" message: a group named by its heading and described by its
 * body, which is never a live region itself, so focus can move to it without a
 * screen reader reading it twice. When `announce` is set, a separate, visually
 * hidden alert announces the same text instead.
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null)
 * const announce = useFocusOrAnnounce(ref, 'not-found')
 * <NotFoundMessage heading="Not found" headingLevel={2} body="It may be gone." groupRef={ref} announce={announce} />
 */
export function NotFoundMessage({
  heading,
  headingLevel,
  body,
  groupRef,
  announce,
  children
}: NotFoundMessageProps): React.JSX.Element {
  const headingId = useId()
  const bodyId = useId()

  return (
    <>
      <div
        ref={groupRef}
        role="group"
        aria-labelledby={headingLevel === 1 ? MAIN_HEADING_ID : headingId}
        aria-describedby={bodyId}
        tabIndex={-1}
      >
        <StatusMessage
          heading={heading}
          headingLevel={headingLevel}
          headingId={headingId}
          body={body}
          bodyId={bodyId}
        >
          {children}
        </StatusMessage>
      </div>
      {announce && (
        <div role="alert" className="visuallyHidden">
          <p>{heading}</p>
          <p>{body}</p>
        </div>
      )}
    </>
  )
}
