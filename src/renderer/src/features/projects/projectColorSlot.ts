/** A project's color slot, 1 to 9, cycled in sidebar order. */
export type ProjectColorSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const satisfies readonly ProjectColorSlot[]

/**
 * Picks a project's color slot from its place in the sidebar, cycling through the nine slots.
 *
 * @param index - The project's 0-based position among the sidebar's top-level projects.
 * @returns The slot, 1 to 9.
 * @throws {RangeError} When `index` is negative or not a whole number.
 */
export function projectColorSlot(index: number): ProjectColorSlot {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError('A project position is a whole number from 0')
  }
  const slot = SLOTS[index % SLOTS.length]
  if (slot === undefined) throw new RangeError('A project position has no color slot')
  return slot
}
