import { err, ok, type Result } from '../shared/result'

/** One changed file's patch, cut from `git diff --raw -z --patch` output. */
export interface PatchFile {
  /** The file's path, or for a rename or copy its new path. Repo-controlled. */
  readonly path: string
  /** The path a rename or copy came from. Repo-controlled. */
  readonly oldPath?: string
  /** The file's whole patch, header lines included, as git wrote it. Not necessarily valid UTF-8. */
  readonly patch: Buffer
}

/** Why {@link parseDiffPatch} could not read git's output. */
export type ParseDiffPatchError = 'malformed-numstat'

/** One record of the raw section: a changed file and, for a rename or copy, where it came from. */
interface RawEntry {
  readonly path: Buffer
  readonly oldPath: Buffer | undefined
}

const COLON = 0x3a
const NEWLINE = 0x0a
const HEADER_PREFIX = 'diff --git '
const CONTROL_ESCAPES: ReadonlyMap<number, string> = new Map([
  [0x07, 'a'],
  [0x08, 'b'],
  [0x09, 't'],
  [0x0a, 'n'],
  [0x0b, 'v'],
  [0x0c, 'f'],
  [0x0d, 'r']
])

/** Reads one NUL-terminated field. */
function readField(buffer: Buffer, from: number): { value: Buffer; next: number } | undefined {
  const end = buffer.indexOf(0, from)
  if (end === -1) return undefined
  return { value: buffer.subarray(from, end), next: end + 1 }
}

/**
 * Reads the raw section: one `:<modes> <ids> <status>` record and its path or
 * paths per changed file, then an empty record that ends the section.
 */
function parseRaw(
  stdout: Buffer
): Result<{ entries: RawEntry[]; patchStart: number }, ParseDiffPatchError> {
  const entries: RawEntry[] = []
  let pos = 0
  while (pos < stdout.length) {
    if (stdout[pos] === 0) return ok({ entries, patchStart: pos + 1 })
    if (stdout[pos] !== COLON) return err('malformed-numstat')

    const meta = readField(stdout, pos + 1)
    const status = meta?.value.toString('latin1').split(' ')[4]?.[0]
    if (meta === undefined || status === undefined) return err('malformed-numstat')
    const first = readField(stdout, meta.next)
    if (first === undefined || first.value.length === 0) return err('malformed-numstat')

    if (status === 'R' || status === 'C') {
      const second = readField(stdout, first.next)
      if (second === undefined || second.value.length === 0) return err('malformed-numstat')
      entries.push({ oldPath: first.value, path: second.value })
      pos = second.next
    } else {
      entries.push({ oldPath: undefined, path: first.value })
      pos = first.next
    }
  }
  return err('malformed-numstat')
}

/**
 * Writes a name the way git does in a `diff --git` header: in double quotes
 * with C escapes when it holds a control character, a double quote, a
 * backslash, or (with `quoteHigh`, git's `core.quotePath`) a byte of 0x80 or
 * more. The name is a string of one character per byte.
 */
function quoteName(name: string, quoteHigh: boolean): string {
  let quoted = false
  let out = ''
  for (const char of name) {
    const code = char.charCodeAt(0)
    if (char === '"' || char === '\\') {
      quoted = true
      out += `\\${char}`
    } else if (code < 0x20 || code === 0x7f || (quoteHigh && code >= 0x80)) {
      quoted = true
      const escape = CONTROL_ESCAPES.get(code)
      out += escape === undefined ? `\\${code.toString(8).padStart(3, '0')}` : `\\${escape}`
    } else {
      out += char
    }
  }
  return quoted ? `"${out}"` : out
}

/**
 * The `diff --git` lines git may write for a file: with and without quoting of
 * non-ASCII bytes, since a repository's config sets that.
 */
function expectedHeaders(entry: RawEntry): Set<string> {
  const oldName = `a/${(entry.oldPath ?? entry.path).toString('latin1')}`
  const newName = `b/${entry.path.toString('latin1')}`
  return new Set(
    [true, false].map(
      (quoteHigh) =>
        `${HEADER_PREFIX}${quoteName(oldName, quoteHigh)} ${quoteName(newName, quoteHigh)}`
    )
  )
}

/**
 * Finds where each file's block starts. A header is the only kind of line
 * that starts with `diff --git `: every line of a patch's body starts with a
 * space, a plus, a minus, `@`, or a backslash.
 */
function blockStarts(patch: Buffer): number[] {
  const starts: number[] = []
  if (patch.subarray(0, HEADER_PREFIX.length).toString('latin1') === HEADER_PREFIX) starts.push(0)
  const marker = Buffer.from(`\n${HEADER_PREFIX}`)
  for (let at = patch.indexOf(marker); at !== -1; at = patch.indexOf(marker, at + 1)) {
    starts.push(at + 1)
  }
  return starts
}

/**
 * Cuts the output of `git diff --raw -z --patch` into one patch per file.
 *
 * @remarks
 * The raw section lists every changed file with its exact path, in the order
 * the patch lists them, so no path is read out of the patch's own quoted,
 * space-ambiguous header. Each block is matched to the next raw entry whose
 * `diff --git` line it carries. An entry with no block is left out, as for a
 * file git changed by stat only, or an unmerged path. A block that matches no
 * remaining entry means the two sections disagree, which is an error.
 *
 * @param stdout - git's output for `--raw -z --patch` with fixed `a/` and `b/` prefixes.
 * @returns The files that have a patch, in git's order.
 */
export function parseDiffPatch(stdout: Buffer): Result<PatchFile[], ParseDiffPatchError> {
  if (stdout.length === 0) return ok([])
  const raw = parseRaw(stdout)
  if (!raw.ok) return err(raw.error)

  const { entries, patchStart } = raw.value
  const patch = stdout.subarray(patchStart)
  const starts = blockStarts(patch)
  const files: PatchFile[] = []
  let next = 0

  for (const [index, start] of starts.entries()) {
    const block = patch.subarray(start, starts[index + 1] ?? patch.length)
    const lineEnd = block.indexOf(NEWLINE)
    const header = block.subarray(0, lineEnd === -1 ? block.length : lineEnd).toString('latin1')
    let entry = entries[next]
    while (entry !== undefined && !expectedHeaders(entry).has(header)) {
      next += 1
      entry = entries[next]
    }
    if (entry === undefined) return err('malformed-numstat')
    files.push({
      path: entry.path.toString('utf-8'),
      ...(entry.oldPath === undefined ? {} : { oldPath: entry.oldPath.toString('utf-8') }),
      patch: block
    })
    next += 1
  }
  return ok(files)
}
