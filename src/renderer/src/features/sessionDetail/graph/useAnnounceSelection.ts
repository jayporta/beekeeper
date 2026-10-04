import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'
import type { AgentKey } from './agentGraphNode'

/** The selection the graph last announced. */
interface Announced {
  /** How many selections have changed so far, so selecting the same node again after another still announces. */
  readonly count: number
  /** The node that was selected before the change, so the next change is told from a re-render. */
  readonly key: AgentKey
  /** What to say. Transcript-derived: render as plain text. */
  readonly message: string
}

/** What the graph has selected. */
interface Selected {
  /** The selected node's key. */
  readonly key: AgentKey
  /** The selected node's name. Transcript-derived. */
  readonly name: string
}

/**
 * Tells a person which node a press or Enter selected, since `aria-current`
 * alone is rarely announced. Only a change of the selected node is announced:
 * the node selected when the graph first shows, a press on the node that is
 * already selected, and the arrow keys moving focus around say nothing.
 *
 * @param selected - The selected node.
 * @returns The text for a polite status region. It is empty until the selection changes, and again after the hidden live copy's clear delay.
 */
export function useAnnounceSelection(selected: Selected): string {
  const { t } = useTranslation('sessionDetail')
  const [announced, setAnnounced] = useState<Announced>({
    count: 0,
    key: selected.key,
    message: ''
  })
  if (announced.key !== selected.key) {
    setAnnounced({
      count: announced.count + 1,
      key: selected.key,
      message: t('graph.announce.selected', { name: selected.name })
    })
  }

  // The ref never holds an element, so the hook never moves focus and always announces.
  const noFocusTarget = useRef<HTMLElement>(null)
  const announce = useFocusOrAnnounce(
    noFocusTarget,
    announced.count === 0 ? '' : `selected:${announced.count}`
  )
  return announce ? announced.message : ''
}
