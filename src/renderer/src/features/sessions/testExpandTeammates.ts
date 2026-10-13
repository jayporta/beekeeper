import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Opens a lead's teammate rows, which start closed, by pressing the agent
 * count button of its row.
 *
 * @param row - The lead's list item.
 * @returns Resolves once the toggle is pressed. Does nothing when the rows are already open.
 */
export async function expandTeammates(row: HTMLElement): Promise<void> {
  const toggle = within(row).getByRole('button', { expanded: false, name: /teammate/ })
  await userEvent.click(toggle)
}
