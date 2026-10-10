import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

/** Props for {@link SeparatedText}. */
interface SeparatedTextProps {
  /** The pieces of text to join, in order. */
  readonly parts: readonly string[]
  /**
   * A node to render right after the part whose text is `after`, such as a partial marker.
   * @defaultValue No marker.
   */
  readonly marker?: { readonly after: string; readonly node: React.ReactNode }
}

/**
 * Pieces of text joined by a "·" separator that assistive technology skips,
 * with plain spaces around it so the pieces never read run together. A marker
 * can follow one piece, before the next separator.
 *
 * @example
 * <SeparatedText parts={[lastActive, model, 'hit 5-hour limit']} />
 */
export function SeparatedText({ parts, marker }: SeparatedTextProps): React.JSX.Element {
  const { t } = useTranslation('sessions')

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && (
            <>
              {' '}
              <span aria-hidden="true">{t('metaSeparator')}</span>{' '}
            </>
          )}
          {part}
          {marker?.after === part && marker.node}
        </Fragment>
      ))}
    </>
  )
}
