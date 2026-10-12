import styles from './projectColor.module.css'
import type { ProjectColorSlot } from './projectColorSlot'

/**
 * The class that sets `--project-color`, `--project-button` and `--project-ink`
 * for a slot, on the element it is put on and everything beneath it.
 *
 * @param slot - The project's color slot.
 * @returns The class name.
 * @throws {Error} When the stylesheet has no class for the slot.
 */
export function projectColorClass(slot: ProjectColorSlot): string {
  const className = styles[`slot${slot}`]
  if (className === undefined)
    throw new Error(`projectColor.module.css has no class for slot ${slot}`)
  return className
}
