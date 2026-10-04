import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'
import type { AgentKey, RootAgentGraphNode } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'
import type { TeammateExpansion } from './teammateExpansion'

/** The latest settled load, and the text that tells of it. */
interface Announcement {
  /** Tells one settled load from the next, so a repeat of the same text still announces. */
  readonly id: string
  /** What to say. Transcript-derived: render as plain text. */
  readonly message: string
}

const NOTHING: Announcement = { id: '', message: '' }

/**
 * Tells what an opened teammate's session load came to, once, so a person who
 * can't see the subagents appear or the node turn partial hears of it. A load
 * is announced the first time it settles: with how many subagents it added (every generation of them), or
 * that it failed. A teammate selected again later, or a load that is still
 * going, says nothing. If several settle in one render, the last is the one
 * announced.
 *
 * @param root - The graph with the opened teammates' subagents under them, which names the teammates.
 * @param expansions - How each opened teammate's load stands, by node key.
 * @returns The text for a polite status region. It is empty until a load settles, and again after the hidden live copy's clear delay.
 */
export function useAnnounceExpansions(
  root: RootAgentGraphNode,
  expansions: ReadonlyMap<AgentKey, TeammateExpansion>
): string {
  const { t } = useTranslation('sessionDetail')
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [latest, setLatest] = useState(NOTHING)

  const fresh = [...expansions].flatMap(([key, expansion]) => {
    const name = root.children.find((child) => child.key === key)?.name
    const id = `${key}:${expansion.status}`
    return expansion.status === 'loading' || name === undefined || seen.has(id)
      ? []
      : [{ id, name, expansion }]
  })
  const newest = fresh.at(-1)
  if (newest !== undefined) {
    setSeen(new Set([...seen, ...fresh.map(({ id }) => id)]))
    const { id, name, expansion } = newest
    setLatest({
      id,
      message:
        expansion.status === 'ready'
          ? t('graph.announce.loaded', {
              count: flattenPreorder({ children: expansion.children }).nodes.length - 1,
              name
            })
          : t('graph.announce.failed', { name })
    })
  }

  // The ref never holds an element, so the hook never moves focus and always announces.
  const noFocusTarget = useRef<HTMLElement>(null)
  return useFocusOrAnnounce(noFocusTarget, latest.id) ? latest.message : ''
}
