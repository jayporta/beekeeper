import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { ArchiveWriter, SourceState } from './createArchiveStore'

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

/** An {@link ArchiveWriter} that records its saves, or throws on every one. */
export interface FakeArchiveWriter extends ArchiveWriter {
  /** The list items saved, in order. */
  readonly listSaves: readonly RecordedListSave[]
  /** The details saved, in order. */
  readonly detailSaves: readonly RecordedDetailSave[]
}

/**
 * Builds a writer that records what it is asked to save.
 *
 * @param failure - When set, every save throws it after recording nothing.
 * @returns The fake writer.
 */
export function createFakeArchiveWriter(failure?: Error): FakeArchiveWriter {
  const listSaves: RecordedListSave[] = []
  const detailSaves: RecordedDetailSave[] = []
  return {
    listSaves,
    detailSaves,
    saveListItem(item, source) {
      if (failure !== undefined) throw failure
      listSaves.push({ item, source })
    },
    saveDetail(ref, { detail, source }) {
      if (failure !== undefined) throw failure
      detailSaves.push({ ref, detail, source })
    },
    hasDetail: () => false
  }
}
