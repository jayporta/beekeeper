import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PartialFootnote } from '../PartialFootnote'
import type { PartialReason } from '../partialReasons'
import { PARTIAL_FOOTNOTE_ID } from '../partialFootnoteId'

const UNREADABLE = "Some transcript lines couldn't be read, so a total may be low."
const MISSING = "Some teammates the lead spawned aren't in this list, so a team total may be low."
const UNRECORDED = 'Some sessions recorded no usage, so a team total leaves them out.'
const SUBAGENTS =
  "A session still running or stopped early shows its transcript's tokens, which leave out its subagents."

describe('PartialFootnote', () => {
  it('renders nothing when no figure is partial', () => {
    const { container } = render(<PartialFootnote reasons={new Set()} />)

    expect(container.textContent).toBe('')
  })

  it('says exactly the reasons given, after the marker, with the id the figures point at', () => {
    const reasons = new Set<PartialReason>(['missingTeammates', 'unreadableLines'])
    render(<PartialFootnote reasons={reasons} />)

    const note = document.getElementById(PARTIAL_FOOTNOTE_ID)
    expect(note?.textContent).toBe(`¹ Partial: ${UNREADABLE} ${MISSING}`)
    expect(screen.queryByText(UNRECORDED, { exact: false })).toBeNull()
  })

  it('lists the reasons in a fixed order whatever order they were found in', () => {
    const reasons = new Set<PartialReason>([
      'subagentsExcluded',
      'unrecordedUsage',
      'missingTeammates',
      'unreadableLines'
    ])
    render(<PartialFootnote reasons={reasons} />)

    expect(document.getElementById(PARTIAL_FOOTNOTE_ID)?.textContent).toBe(
      `¹ Partial: ${UNREADABLE} ${MISSING} ${UNRECORDED} ${SUBAGENTS}`
    )
  })

  it('says an override in place of its reason’s sentence, and the list’s sentence for the others', () => {
    const reasons = new Set<PartialReason>(['missingTeammates', 'unreadableLines'])
    render(<PartialFootnote reasons={reasons} overrides={{ missingTeammates: 'Custom.' }} />)

    expect(document.getElementById(PARTIAL_FOOTNOTE_ID)?.textContent).toBe(
      `¹ Partial: ${UNREADABLE} Custom.`
    )
  })
})
