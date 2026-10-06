import { useId } from 'react'
import styles from './SegmentedControl.module.css'

/** One choice of a {@link SegmentedControl}. */
export interface SegmentedOption<T extends string> {
  /** What choosing it reports. */
  readonly value: T
  /** The text shown on the segment. */
  readonly label: string
}

/** Props for {@link SegmentedControl}. */
interface SegmentedControlProps<T extends string> {
  /** The group's accessible name. */
  readonly label: string
  /** The choices, in display order. */
  readonly options: readonly SegmentedOption<T>[]
  /** The chosen option's value. */
  readonly value: T
  /** Called with an option's value when it is chosen, by click or arrow key. */
  readonly onChange: (value: T) => void
}

/**
 * A row of mutually exclusive choices that reads as one control, such as a
 * time window. It is a radio group built on native radio inputs, so the arrow
 * keys move and select within it, it is one tab stop, and the selected
 * segment has an accent fill.
 *
 * @example
 * <SegmentedControl
 *   label="Time window"
 *   options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }]}
 *   value={window}
 *   onChange={setWindow}
 * />
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange
}: SegmentedControlProps<T>): React.JSX.Element {
  const name = useId()

  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((option) => (
        <label key={option.value} className={styles.segment}>
          <input
            type="radio"
            name={name}
            className="visuallyHidden"
            checked={option.value === value}
            onChange={() => {
              onChange(option.value)
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
