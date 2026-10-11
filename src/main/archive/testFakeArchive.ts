import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import type {
  ArchivedLeadSlots,
  ArchivedSession,
  ArchiveReader,
  ArchiveWriter,
  ListItemEntry,
  SourceState
} from './archiveStoreTypes'

/** A list item save the fake received, with its source state and sidecars. */
export type RecordedListSave = ListItemEntry

/** A detail save the fake received. */
export interface RecordedDetailSave {
  /** The session the detail was saved for. */
  readonly ref: SessionRefDto
  /** The saved detail. */
  readonly detail: SessionDetailDto
  /** The source state it was saved with. */
  readonly source: SourceState
}

/** An archive that records its saves and answers reads from what it was given. */
export interface FakeArchive extends ArchiveWriter, ArchiveReader {
  /** The list items saved, in order, across every batch. */
  readonly listSaves: readonly RecordedListSave[]
  /** The list item batches saved, in order. */
  readonly listBatches: readonly (readonly RecordedListSave[])[]
  /** The details saved, in order. */
  readonly detailSaves: readonly RecordedDetailSave[]
}

/** What a fake archive answers reads with. */
export interface FakeArchiveReads {
  /** The list items it holds, from any folder. Its sessions carry no team spawns. */
  readonly listItems?: readonly SessionListItemDto[]
  /** The sessions it holds, from any folder, after those built from `listItems`. */
  readonly sessions?: readonly ArchivedSession[]
  /** The lead slots it holds, keyed by {@link sessionRefKey}. A session not in it has none. */
  readonly leadSlots?: ReadonlyMap<string, ArchivedLeadSlots>
  /** The details it holds, keyed by {@link sessionRefKey}. */
  readonly details?: ReadonlyMap<string, SessionDetailDto>
}

/**
 * Builds an archive that records what it is asked to save and answers reads
 * from what it was given, the way the store does.
 *
 * @param failure - When set, every save and read throws it. Saves record nothing.
 * @param reads - The list items and details it holds.
 * @returns The fake archive.
 */
export function createFakeArchive(failure?: Error, reads: FakeArchiveReads = {}): FakeArchive {
  const listSaves: RecordedListSave[] = []
  const listBatches: RecordedListSave[][] = []
  const detailSaves: RecordedDetailSave[] = []

  function readSessions(
    projectDirName: string,
    excluding: ReadonlySet<string>
  ): readonly ArchivedSession[] {
    if (failure !== undefined) throw failure
    return [
      ...(reads.listItems ?? []).map((item) => ({ item, teamSpawns: null })),
      ...(reads.sessions ?? [])
    ].filter(({ item }) => item.projectDirName === projectDirName && !excluding.has(item.sessionId))
  }

  return {
    listSaves,
    listBatches,
    detailSaves,
    saveListItems(entries) {
      if (failure !== undefined) throw failure
      listBatches.push([...entries])
      listSaves.push(...entries)
    },
    saveDetail(ref, { detail, source }) {
      if (failure !== undefined) throw failure
      detailSaves.push({ ref, detail, source })
    },
    readSessions,
    readLeadSlots(ref) {
      if (failure !== undefined) throw failure
      return reads.leadSlots?.get(sessionRefKey(ref)) ?? null
    },
    readDetail(ref) {
      if (failure !== undefined) throw failure
      return reads.details?.get(sessionRefKey(ref)) ?? null
    }
  }
}
