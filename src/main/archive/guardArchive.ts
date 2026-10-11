import type { ArchiveReader, ArchiveWriter } from '../../service/archive/archivePort'
import { guardArchiveCall } from './guardArchiveCall'

/**
 * Wraps an archive store so that none of its reads or writes throws, which is
 * what the services' archive port promises. A failed read answers as the
 * archive having nothing, and a failed write is skipped. Each failure is
 * logged once per kind and code for the process, by its code and never its
 * message.
 *
 * @param store - The store to guard.
 * @param log - Receives the one-line logs. Defaults to `console.warn`.
 * @returns An archive that never throws.
 */
export function guardArchive(
  store: ArchiveWriter & ArchiveReader,
  log: (line: string) => void = console.warn
): ArchiveWriter & ArchiveReader {
  return {
    saveListItems: (entries) =>
      guardArchiveCall({
        run: () => store.saveListItems(entries),
        fallback: undefined,
        kind: 'write',
        log
      }),
    saveDetail: (ref, entry) =>
      guardArchiveCall({
        run: () => store.saveDetail(ref, entry),
        fallback: undefined,
        kind: 'write',
        log
      }),
    readSessions: (projectDirName, excluding) =>
      guardArchiveCall({
        run: () => store.readSessions(projectDirName, excluding),
        fallback: [],
        kind: 'read',
        log
      }),
    readLeadSlots: (ref) =>
      guardArchiveCall({ run: () => store.readLeadSlots(ref), fallback: null, kind: 'read', log }),
    readDetail: (ref) =>
      guardArchiveCall({ run: () => store.readDetail(ref), fallback: null, kind: 'read', log })
  }
}
