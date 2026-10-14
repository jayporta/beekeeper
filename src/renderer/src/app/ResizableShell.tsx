import { useTranslation } from 'react-i18next'
import styles from './ResizableShell.module.css'
import { SidebarResizer } from './SidebarResizer'
import { SIDEBAR_ID } from './sidebarId'
import { useSidebarWidth } from './useSidebarWidth'

/** The props of {@link ResizableShell}. */
interface ResizableShellProps {
  /** Rendered first, such as a skip link. */
  skipLink: React.ReactNode
  /** The bar across the top of the window. It stays at the top of the window, above the columns, while the page scrolls under it. */
  titleBar: React.ReactNode
  /** The sidebar landmark's content, beside its resize handle. */
  sidebar: React.ReactNode
  /** The main landmark. */
  main: React.ReactNode
  /** Anything else the shell holds, such as dialogs. */
  children?: React.ReactNode
}

/**
 * The two-column shell with a resizable sidebar, under a title bar. It owns the width state, so a
 * drag or a window resize re-renders only the shell: the parts passed in keep
 * their element identity and React skips them.
 *
 * @example
 * <ResizableShell skipLink={<SkipLink />} titleBar={<TitleBar />} sidebar={<SidebarContent />} main={<main />} />
 */
export function ResizableShell({
  skipLink,
  titleBar,
  sidebar,
  main,
  children
}: ResizableShellProps): React.JSX.Element {
  const { t } = useTranslation()
  const size = useSidebarWidth()

  return (
    <>
      {skipLink}
      {titleBar}
      {/* The one inline style: a class can't carry the runtime width, so it goes in a custom property
          that the stylesheet reads. React sets it through the CSSOM, which the CSP allows. */}
      <div
        className={styles.shell}
        style={{ '--size-sidebar-current': `${size.width}px` } as React.CSSProperties}
      >
        <aside id={SIDEBAR_ID} className={styles.sidebar} aria-label={t('sidebar')}>
          {sidebar}
          <SidebarResizer
            width={size.width}
            min={size.min}
            max={size.max}
            onPreview={size.preview}
            onCommit={size.commit}
            onCancel={size.cancel}
          />
        </aside>
        {main}
        {children}
      </div>
    </>
  )
}
