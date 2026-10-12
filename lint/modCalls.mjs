// @ts-check

/**
 * @typedef {object} ParsedReport
 * @property {string[]} calls - Every `$` call the mod's modules make, such as `$.ui.open`.
 * @property {string[]} envReads - The environment variables the modules read.
 * @property {string[]} envWrites - The environment variables the modules write.
 * @property {string[]} stateWrites - The `$.state` keys the modules write.
 * @property {string[]} uncaughtGates - Each gating hook without a `.catch`, as "module hook".
 * @property {string[]} errors - Everything validate reported as wrong.
 */

/**
 * @typedef {object} Allowlist
 * @property {readonly string[]} calls - The `$` calls the mod may make.
 * @property {readonly string[]} envReads - The environment variables the mod may read.
 */

/**
 * Every note validate prints for the mod, as "<module> <label>: <value>". The ones that list what a
 * module does are read; the rest are informational. A note with any other label is an error, so a
 * renamed label cannot hide a call.
 */
const NOTE_LINE =
  /^(\S+) (hooks|answers its own command|gating hook without \.catch|calls|env reads|env writes|state writes): (.*)$/

/** The notes that list what a module does, by label. */
const READ_LABELS = ['calls', 'env reads', 'env writes', 'state writes']

/**
 * Fails with the one error every malformed report gets.
 *
 * @param {string} detail - What was wrong.
 * @returns {never}
 */
function malformed(detail) {
  throw new Error(
    `Unexpected validate report: ${detail}. Did \`claude plugin validate --json\` change?`
  )
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @param {string} where - Names the field for the error message.
 * @returns {unknown[]}
 */
function arrayOf(value, where) {
  return Array.isArray(value) ? value : malformed(`${where} is not an array`)
}

/**
 * Describes one entry of an `errors` list, which validate writes as an object or a string.
 *
 * @param {unknown} error
 * @returns {string}
 */
function describeError(error) {
  if (typeof error === 'string') return error
  if (isRecord(error) && typeof error.message === 'string') {
    return typeof error.path === 'string' && error.path !== ''
      ? `${error.path}: ${error.message}`
      : error.message
  }
  return malformed('an error entry is neither a string nor an object with a message')
}

/**
 * Splits the value of a note line into names, dropping the "(via hostOf)" marker.
 *
 * @param {string} value - What follows the colon: `$.fs.read (via hostOf), $.ui.open`.
 * @returns {string[]}
 */
function namesOf(value) {
  if (/^nothing( on \$)?$/.test(value.trim())) return []
  return value
    .split(',')
    .map((name) => name.replace(/\s*\(via [^)]*\)\s*$/, '').trim())
    .filter((name) => name !== '')
}

/**
 * Reads a `claude plugin validate --json` report. Calls and environment names are strings in each
 * content entry's `notes`, such as `./register.js calls: $.a.b (via hostOf), $.c.d`. Validate omits
 * the env and state lines when a module has none.
 *
 * @param {unknown} report - The parsed JSON.
 * @returns {ParsedReport} What the modules do, and what validate found wrong.
 * @throws {Error} When the report is not the expected shape, or has no `calls:` note at all.
 */
export function parseValidateReport(report) {
  if (!isRecord(report)) return malformed('it is not an object')
  if (typeof report.success !== 'boolean') return malformed('`success` is not a boolean')
  if (!isRecord(report.manifest)) return malformed('`manifest` is not an object')
  const entries = arrayOf(report.contents, '`contents`')

  /** @type {ParsedReport} */
  const parsed = {
    calls: [],
    envReads: [],
    envWrites: [],
    stateWrites: [],
    uncaughtGates: [],
    errors: arrayOf(report.manifest.errors, '`manifest.errors`').map(describeError)
  }
  if (!report.success) parsed.errors.push('validate reported success: false')

  const fields = {
    calls: parsed.calls,
    'env reads': parsed.envReads,
    'env writes': parsed.envWrites,
    'state writes': parsed.stateWrites
  }
  let sawCalls = false
  for (const entry of entries) {
    if (!isRecord(entry)) return malformed('a `contents` entry is not an object')
    parsed.errors.push(...arrayOf(entry.errors, '`contents[].errors`').map(describeError))
    for (const note of arrayOf(entry.notes, '`contents[].notes`')) {
      if (typeof note !== 'string') return malformed('a note is not a string')
      const match = NOTE_LINE.exec(note)
      if (!match) {
        throw new Error(
          `Unexpected validate note: ${note}. Did \`claude plugin validate --json\` change?`
        )
      }
      if (!READ_LABELS.includes(match[2] ?? '')) continue
      const kind = /** @type {keyof typeof fields} */ (match[2])
      if (kind === 'calls') sawCalls = true
      fields[kind].push(...namesOf(match[3] ?? ''))
    }
    for (const gate of arrayOf(entry.gatingHooks, '`contents[].gatingHooks`')) {
      if (!isRecord(gate) || typeof gate.hasCatch !== 'boolean') {
        return malformed('a gating hook has no `hasCatch`')
      }
      if (!gate.hasCatch) parsed.uncaughtGates.push(`${String(gate.module)} ${String(gate.hook)}`)
    }
  }
  if (!sawCalls) return malformed('no module has a "calls:" note')
  return parsed
}

/**
 * Compares what the mod does with what it may do.
 *
 * @param {ParsedReport} parsed - From {@link parseValidateReport}.
 * @param {Allowlist} allowlist - What the mod may do.
 * @returns {string[]} One line per violation; empty means clean.
 */
export function findViolations(parsed, allowlist) {
  return [
    ...parsed.errors.map((error) => `validate error: ${error}`),
    ...parsed.calls
      .filter((call) => !allowlist.calls.includes(call))
      .map((call) => `call not on the allowlist: ${call}`),
    ...parsed.envReads
      .filter((name) => !allowlist.envReads.includes(name))
      .map((name) => `env read not on the allowlist: ${name}`),
    ...parsed.envWrites.map((name) => `env write is never allowed: ${name}`),
    ...parsed.stateWrites.map((key) => `state write is never allowed: ${key}`),
    ...parsed.uncaughtGates.map((gate) => `gating hook without .catch: ${gate}`)
  ]
}
