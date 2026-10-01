import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { lastActiveMs } from './lastActiveMs'
import { sessionKey } from './sessionKey'
import { sessionLabel } from './sessionLabel'
import type { SessionRow } from './sessionRow'
import type { SessionsT } from './sessionsT'

function byLastActiveDescending(a: SessionRow, b: SessionRow): number {
  const aMs = lastActiveMs(a.item)
  const bMs = lastActiveMs(b.item)
  if (aMs !== bMs) {
    if (aMs === null) return 1
    if (bMs === null) return -1
    return bMs - aMs
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

/**
 * Arranges a project's session list into table rows. Leads, teammates whose
 * lead isn't in the list, and ungrouped teammates are top-level rows. The
 * teammates of a lead nest under it in the lead's order, and a session nests
 * at most once and never also appears top-level. Top-level rows are sorted by
 * last active time, newest first, with unknown times last.
 *
 * @param items - The sessions from `listSessions`, each keyed by folder and id.
 * @param t - The sessions translate function, to label each row once.
 * @returns The top-level rows.
 */
export function groupSessionRows(
  items: readonly SessionListItemDto[],
  t: SessionsT
): readonly SessionRow[] {
  const byKey = new Map<string, SessionListItemDto>()
  for (const item of items) {
    const key = sessionKey(item)
    if (!byKey.has(key)) byKey.set(key, item)
  }

  const nestedKeys = new Set<string>()
  const teammatesOf = new Map<string, SessionRow[]>()
  for (const [key, item] of byKey) {
    if (item.team?.kind !== 'lead') continue

    const nested: SessionRow[] = []
    for (const ref of item.team.teammates) {
      const childKey = sessionKey(ref)
      const child = byKey.get(childKey)
      if (child === undefined || child.team?.kind === 'lead' || nestedKeys.has(childKey)) continue
      nestedKeys.add(childKey)
      nested.push({
        key: childKey,
        item: child,
        label: sessionLabel(child, t),
        teammates: [],
        leadFolder: null
      })
    }
    teammatesOf.set(key, nested)
  }

  const rows: SessionRow[] = []
  for (const [key, item] of byKey) {
    if (nestedKeys.has(key)) continue
    rows.push({
      key,
      item,
      label: sessionLabel(item, t),
      teammates: teammatesOf.get(key) ?? [],
      leadFolder: item.team?.kind === 'teammate' ? item.team.lead.projectDirName : null
    })
  }
  return rows.sort(byLastActiveDescending)
}
