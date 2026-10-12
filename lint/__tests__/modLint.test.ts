import { beforeAll, describe, expect, it } from 'vitest'
import { reportedRules, WARM_UP_TIMEOUT_MS } from '../testLint'

const MOD_FILE = 'src/mod/features/start/probe.ts'
const ENGINE_IMPORT = "import type { Engine } from 'claude-code'\nexport type E = Engine\n"

describe('mod lint rules', () => {
  // The first lint pays ESLint's start-up cost, which can pass a test's 5s timeout under full-suite load.
  beforeAll(async () => {
    await reportedRules(MOD_FILE, '')
  }, WARM_UP_TIMEOUT_MS)

  it.each([
    ['a Node module', "import { join } from 'node:path'\nexport const s = join\n"],
    ['a bare Node module', "import { readFile } from 'fs'\nexport const s = readFile\n"],
    ['a network module', "import { request } from 'node:http'\nexport const s = request\n"]
  ])('bans importing %s in the mod', async (_label, code) => {
    expect(await reportedRules(MOD_FILE, code)).toContain('no-restricted-imports')
  })

  it.each(["Buffer.from('x')", 'process.platform', "fetch('https://example.com')"])(
    'bans the global in the mod: %s',
    async (expression) => {
      const rules = await reportedRules(MOD_FILE, `export const s = ${expression}\n`)

      expect(rules).toContain('no-restricted-globals')
    }
  )

  it.each(['src/mod/__tests__/probe.test.ts', 'src/mod/testProbe.ts'])(
    'allows a Node module import in %s',
    async (path) => {
      const rules = await reportedRules(
        path,
        "import { join } from 'node:path'\nexport const s = join\n"
      )

      expect(rules).not.toContain('no-restricted-imports')
    }
  )

  it('bans the claude-code import outside register.ts', async () => {
    expect(await reportedRules(MOD_FILE, ENGINE_IMPORT)).toContain('no-restricted-imports')
  })

  it('allows the claude-code import in register.ts', async () => {
    expect(await reportedRules('src/mod/register.ts', ENGINE_IMPORT)).not.toContain(
      'no-restricted-imports'
    )
  })

  it.each([
    ['a Node module', "import { join } from 'node:path'\nexport const s = join\n"],
    ['the network', "export const s = fetch('https://example.com')\n"]
  ])('still bans %s in register.ts', async (_label, code) => {
    const rules = await reportedRules('src/mod/register.ts', code)

    expect(rules.some((rule) => rule.startsWith('no-restricted-'))).toBe(true)
  })

  it('reports a literal string in a mod component', async () => {
    const rules = await reportedRules(
      'src/mod/features/pane/Probe.tsx',
      'export const Probe = () => <Text>Hello</Text>\n'
    )

    expect(rules).toContain('i18next/no-literal-string')
  })

  it('does not report a layout prop in a mod component', async () => {
    const rules = await reportedRules(
      'src/mod/features/pane/Probe.tsx',
      'import { t } from \'../../i18n/modI18n\'\nexport const Probe = () => <Box flexDirection="column" borderStyle="round"><Text dimColor>{t(\'pane.empty\')}</Text></Box>\n'
    )

    expect(rules).not.toContain('i18next/no-literal-string')
  })
})
