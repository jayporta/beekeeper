import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { PartialMarker } from '@renderer/components/PartialMarker'
import { withClassName } from '@renderer/components/withClassName'
import type { ModelShare } from './byModelTotals'
import type { ModelFamily } from './modelFamily'
import styles from './ModelRing.module.css'

/** The ring's size and band in SVG units, which are CSS pixels at the design size. */
const SIZE = 156
const BAND = 26
const CENTER = SIZE / 2
const RADIUS = (SIZE - BAND) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** The class of each family's flat stroke. Haiku and other stroke a pattern instead. */
const STROKE_CLASSES = {
  fable: styles.fable,
  opus: styles.opus,
  sonnet: styles.sonnet,
  haiku: undefined,
  other: undefined
} as const satisfies Record<ModelFamily, string | undefined>

/** The families whose arcs stroke a pattern, so they are told apart without color. */
const PATTERNED = new Set<ModelFamily>(['haiku', 'other'])

/** Props for {@link ModelRing}. */
interface ModelRingProps {
  /** Each family's share, from `byModelTotals`. */
  readonly rows: readonly ModelShare[]
  /** The tokens over every day, shown in the middle. */
  readonly total: number
  /** Whether the total may be low, which marks it with a "¹". */
  readonly partial: boolean
}

/**
 * A ring of the window's tokens by model family, with the compact total in the
 * middle. The ring is decorative and hidden from assistive technology: the
 * rows beside it give every figure as text. Haiku is dotted and other is
 * hatched, as in the chart, so neither relies on color alone.
 *
 * @example
 * <ModelRing rows={byModelTotals(series, total)} total={total} partial={false} />
 */
export function ModelRing({ rows, total, partial }: ModelRingProps): React.JSX.Element {
  const { t } = useTranslation('overview')
  const patternId = useId()
  const arcs = rows
    .filter((row) => row.fraction > 0)
    .map((row, index, visible) => ({
      row,
      start: visible.slice(0, index).reduce((sum, earlier) => sum + earlier.fraction, 0)
    }))

  return (
    <div className={styles.ring}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" className={styles.svg}>
        <defs>
          <pattern id={`${patternId}-haiku`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" className={styles.haikuGround} />
            <circle cx="3" cy="3" r="1.25" className={styles.haikuDot} />
          </pattern>
          <pattern
            id={`${patternId}-other`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="3" height="6" className={styles.otherStripe} />
          </pattern>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={RADIUS} strokeWidth={BAND} className={styles.track} />
        {arcs.map(({ row, start }) => {
          const length = row.fraction * CIRCUMFERENCE
          return (
            <circle
              key={row.key}
              data-family={row.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              strokeWidth={BAND}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-start * CIRCUMFERENCE}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              stroke={PATTERNED.has(row.key) ? `url(#${patternId}-${row.key})` : undefined}
              className={withClassName(styles.segment, STROKE_CLASSES[row.key])}
            />
          )
        })}
      </svg>
      <div className={styles.center}>
        <p className={styles.total}>
          {t('dailyUsage.figure', { value: total })}
          {partial && <PartialMarker note={t('dailyUsage.partialNote')} />}
        </p>
        <p className={styles.unit}>{t('byModel.unit')}</p>
      </div>
    </div>
  )
}
