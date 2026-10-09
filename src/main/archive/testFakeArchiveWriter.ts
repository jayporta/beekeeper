import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import type { ArchiveReader, ArchiveWriter, SourceState } from './archiveStoreTypes'

/** A list item save the fake received. */
export interface RecordedListSave {
  /** The saved item. */
  readonly item: SessionListItemDto
  /** The source state it was saved with. */
  readonly source: SourceState
}

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
export interface FakeArchiveWriter extends ArchiveWriter, ArchiveReader {
  /** The list items saved, in order, across every batch. */
  readonly listSaves: readonly RecordedListSave[]
  /** The list item batches saved, in order. */
  readonly listBatches: readonly (readonly RecordedListSave[])[]
  /** The details saved, in order. */
  readonly detailSaves: readonly RecordedDetailSave[]
}

/** What a fake archive answers reads with. */
export interface FakeArchiveReads {
  /** The list items it holds, from any folder. */
  readonly listItems?: readonly SessionListItemDto[]
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
export function createFakeArchiveWriter(
  failure?: Error,
  reads: FakeArchiveReads = {}
): FakeArchiveWriter {
  const listSaves: RecordedListSave[] = []
  const listBatches: RecordedListSave[][] = []
  const detailSaves: RecordedDetailSave[] = []
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
    readListItems(projectDirName, excluding) {
      if (failure !== undefined) throw failure
      return (reads.listItems ?? []).filter(
        (item) => item.projectDirName === projectDirName && !excluding.has(item.sessionId)
      )
    },
    readDetail(ref) {
      if (failure !== undefined) throw failure
      return reads.details?.get(sessionRefKey(ref)) ?? null
    }
  }
}
