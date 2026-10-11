import { beforeAll, describe, expect, it } from 'vitest'
import { reportedRules, WARM_UP_TIMEOUT_MS } from '../testLint'

const CORE_FILE = 'src/core/transcript/probe.ts'

describe('core Node bans', () => {
  // The first lint pays ESLint's start-up cost, which can pass a test's 5s timeout under full-suite load.
  beforeAll(async () => {
    await reportedRules(CORE_FILE, '')
  }, WARM_UP_TIMEOUT_MS)

  it.each([
    "import { readFile } from 'node:fs/promises'",
    "import { join } from 'path'",
    "import { createReadStream } from 'fs'"
  ])('bans a Node module import in core: %s', async (statement) => {
    const rules = await reportedRules(CORE_FILE, `${statement}\nexport const s = 1\n`)

    expect(rules).toContain('no-restricted-imports')
  })

  it.each([
    ['its Node adapter', 'src/core/io/node/probe.ts'],
    ['a core test', 'src/core/transcript/__tests__/probe.test.ts'],
    ['a core test helper', 'src/core/transcript/testProbe.ts'],
    ['the git folder, until it moves behind a port', 'src/core/git/probe.ts']
  ])('allows a Node module import in %s', async (_label, path) => {
    const rules = await reportedRules(
      path,
      "import { join } from 'node:path'\nexport const s = join\n"
    )

    expect(rules).not.toContain('no-restricted-imports')
  })

  it.each(["Buffer.from('x')", 'process.platform', 'setImmediate(() => {})'])(
    'bans a Node global in core: %s',
    async (expression) => {
      const rules = await reportedRules(
        'src/core/session/probe.ts',
        `export const s = ${expression}\n`
      )

      expect(rules).toContain('no-restricted-globals')
    }
  )

  it('still bans a bare network module import in core', async () => {
    const rules = await reportedRules(
      CORE_FILE,
      "import { request } from 'http'\nexport const s = request\n"
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('still bans the fetch global in core', async () => {
    const rules = await reportedRules(CORE_FILE, "export const s = fetch('x')\n")

    expect(rules).toContain('no-restricted-globals')
  })
})
