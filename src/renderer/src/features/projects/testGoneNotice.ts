import { screen, waitFor } from '@testing-library/react'

type NoticePart = 'visible' | 'announced'

/**
 * The elements that carry a gone-folder notice's text: the visible notice, and
 * the status region that announces it. Either is `null` when it doesn't show `text`.
 */
export function goneNoticeParts(text: string | RegExp): Record<NoticePart, HTMLElement | null> {
  const matches = screen.queryAllByText(text)
  return {
    visible: matches.find((element) => element.getAttribute('role') !== 'status') ?? null,
    announced: matches.find((element) => element.getAttribute('role') === 'status') ?? null
  }
}

async function findPart(part: NoticePart, text: string): Promise<HTMLElement> {
  return waitFor(() => {
    const element = goneNoticeParts(text)[part]
    if (element === null) throw new Error(`No ${part} notice says "${text}"`)
    return element
  })
}

/** Waits for the visible notice to show `text`, and returns it. */
export const findVisibleGoneNotice = (text: string): Promise<HTMLElement> =>
  findPart('visible', text)

/** Waits for the status region to announce `text`, and returns it. */
export const findAnnouncedGoneNotice = (text: string): Promise<HTMLElement> =>
  findPart('announced', text)
