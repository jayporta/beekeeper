import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const eslint = new ESLint({ cwd: repoRoot })

/** The rules that reported on `code` linted as if it lived at `path`. */
async function reportedRules(path: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(repoRoot, path) })
  return (result?.messages ?? []).flatMap((message) => (message.ruleId ? [message.ruleId] : []))
}

const OTEL_FILE = 'src/main/otel/probe.ts'
const OTHER_FILE = 'src/main/probe.ts'

describe('network bans', () => {
  it.each(['node:http', 'http'])('allows %s in the telemetry receiver folder', async (module) => {
    const rules = await reportedRules(
      OTEL_FILE,
      `import { createServer } from '${module}'\nexport const s = createServer\n`
    )

    expect(rules).not.toContain('no-restricted-imports')
  })

  it.each(['node:http', 'http'])(
    'bans %s outside the telemetry receiver folder',
    async (module) => {
      const rules = await reportedRules(
        OTHER_FILE,
        `import { createServer } from '${module}'\nexport const s = createServer\n`
      )

      expect(rules).toContain('no-restricted-imports')
    }
  )

  it.each([
    'node:https',
    'https',
    'node:net',
    'net',
    'node:tls',
    'tls',
    'node:dgram',
    'dgram',
    'node:http2',
    'http2'
  ])('still bans %s in the telemetry receiver folder', async (module) => {
    const rules = await reportedRules(
      OTEL_FILE,
      `import * as m from '${module}'\nexport const s = m\n`
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('still bans the electron net module in the telemetry receiver folder', async () => {
    const rules = await reportedRules(
      OTEL_FILE,
      "import { net } from 'electron'\nexport const s = net\n"
    )

    expect(rules).toContain('no-restricted-imports')
  })

  it('allows other electron imports in the telemetry receiver folder', async () => {
    const rules = await reportedRules(
      OTEL_FILE,
      "import { app } from 'electron'\nexport const s = app\n"
    )

    expect(rules).not.toContain('no-restricted-imports')
  })

  it.each(['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'])(
    'still bans the %s global in the telemetry receiver folder',
    async (name) => {
      const rules = await reportedRules(OTEL_FILE, `export const s = ${name}\n`)

      expect(rules).toContain('no-restricted-globals')
    }
  )
})
