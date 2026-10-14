import styles from './TitleBar.module.css'
import { useWindowControlsOverlay } from './useWindowControlsOverlay'

/** Props for {@link TitleBar}. */
interface TitleBarProps {
  /** What the bar holds, such as the Back button. */
  readonly children?: React.ReactNode
}

/**
 * The page's own title bar, a full-width row that stays at the top of the
 * window. Where the window's controls float over the page it clears them and
 * drags the window; controls inside it opt out of dragging.
 *
 * @example
 * <TitleBar><BackButton canGoBack={canGoBack} onBack={goBack} /></TitleBar>
 */
export function TitleBar({ children }: TitleBarProps): React.JSX.Element {
  const overlay = useWindowControlsOverlay()

  return (
    <div className={styles.bar} data-overlay={overlay}>
      {children}
    </div>
  )
}
