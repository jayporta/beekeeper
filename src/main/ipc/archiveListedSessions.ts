import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { LeadUsage } from '../../core/transcript/summary/leadUsage'
import type { ArchivedLeadSlots, ListItemEntry } from '../../service/archive/archivePort'
import { safeArchiveWrite } from '../archive/safeArchiveWrite'
import type { IpcDeps } from './ipcDeps'
import type { ScannedSession } from './mapSessionListItem'

/** A listed session beside the item sent for it. */
export interface ListedItem {
  /** The scanned session. */
  readonly session: ScannedSession
  /** The list item mapped from it. */
  readonly item: SessionListItemDto
}

/** Options for {@link archiveListedSessions}. */
export interface ArchiveListedSessionsOptions {
  /** Where to archive, or `null` to archive nothing. */
  readonly archive: IpcDeps['archive']
  /** The folder the list was requested for. */
  readonly projectDirName: string
  /** The listed sessions with their items. */
  readonly listed: readonly ListedItem[]
}

/** What usage over time keeps of a session's lead usage: its slots, without the message ids. */
function leadSlotsOf(leadUsage: LeadUsage | null): ArchivedLeadSlots | null {
  if (leadUsage === null) return null
  const { slots, undatedMessages, invalidAssistantRecords } = leadUsage
  return { slots, undatedMessages, invalidAssistantRecords }
}

/**
 * Archives the list items of a folder's own sessions whose summary was read.
 * A family teammate listed from another folder belongs to that folder's own
 * list, and a session whose summary failed has nothing worth keeping. The
 * items are saved in one batch, each with the teammates its transcript spawned
 * and stopped and its lead usage per slot, which the summary the item was
 * mapped from holds. A failing write is logged once per kind and
 * never fails the list.
 *
 * @param options - The archive, the requested folder, and the listed items.
 */
export function archiveListedSessions(options: ArchiveListedSessionsOptions): void {
  const { archive, projectDirName, listed } = options
  if (archive === null) return
  const entries: ListItemEntry[] = []
  for (const { session, item } of listed) {
    const { transcript } = session.entry
    const { summary } = session
    if (session.projectDirName !== projectDirName || !item.summary.ok || !summary.ok) continue
    if (!transcript.ok) continue
    entries.push({
      item,
      source: { mtimeMs: transcript.value.mtimeMs, size: transcript.value.size },
      teamSpawns: summary.value.teamSpawns,
      leadSlots: leadSlotsOf(summary.value.leadUsage)
    })
  }
  if (entries.length > 0) safeArchiveWrite(() => archive.saveListItems(entries))
}
