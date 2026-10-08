import type { Series } from './seriesOf'

/**
 * The text that names a series: a model's id as it is, or the other series' name.
 *
 * @param series - The series.
 * @param otherModels - The name of the series that holds the models outside the top few, already translated.
 * @returns The series' display text. A model id is transcript-derived: render it as plain text.
 */
export function seriesLabel(series: Series, otherModels: string): string {
  return series.key.kind === 'model' ? series.key.model : otherModels
}
