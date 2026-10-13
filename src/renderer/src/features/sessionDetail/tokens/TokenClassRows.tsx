import { useTranslation } from 'react-i18next'
import styles from './TokenClassRows.module.css'
import type { TokenClassTotal } from './tokenClasses'

/** Props for {@link TokenClassRows}. */
interface TokenClassRowsProps {
  /** The classes to list, from `tokenClasses`. */
  readonly classes: readonly TokenClassTotal[]
}

/**
 * The token classes as a list: a swatch in the class's bar color, its label,
 * and its tokens, right-aligned. The swatch is decoration, since the label
 * names the class.
 *
 * @example
 * <TokenClassRows classes={tokenClasses(reports)} />
 */
export function TokenClassRows({ classes }: TokenClassRowsProps): React.JSX.Element {
  const { t } = useTranslation('sessionDetail')

  return (
    <ul className={styles.rows}>
      {classes.map(({ tokenClass, tokens }) => (
        <li key={tokenClass} className={styles.row}>
          <span className={`${styles.swatch} ${styles[tokenClass]}`} aria-hidden="true" />
          <span>{t(`inspector.tokenClass.${tokenClass}`)}</span>
          <span className={styles.value}>{t('inspector.tokenValue', { count: tokens })}</span>
        </li>
      ))}
    </ul>
  )
}
